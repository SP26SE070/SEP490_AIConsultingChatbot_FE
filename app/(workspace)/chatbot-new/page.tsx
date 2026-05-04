"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatView } from "@/components/chat/ChatView";
import { SearchView } from "@/components/chat/SearchView";
import { ChatbotAnalyticsView } from "@/components/chat/ChatbotAnalyticsView";
import { ChatbotNewHeader } from "@/components/chat/ChatbotNewHeader";
import { ChatbotEntryLoading } from "@/components/chat/ChatbotEntryLoading";
import { getCurrentUserPermissions, getProfile } from "@/lib/api/profile";
import { getAccessToken, getStoredUser, tryRefreshAuth } from "@/lib/auth-store";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useLivePolling } from "@/lib/hooks/useLivePolling";

function decodePermissionsFromJwt(token: string | null): string[] {
  if (!token) return [];
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return [];
    const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payloadText = atob(padded);
    const payload = JSON.parse(payloadText) as Record<string, unknown>;
    const candidates = [
      payload.permissions,
      payload.authorities,
      payload.scopes,
      payload.scope,
    ];
    for (const entry of candidates) {
      if (Array.isArray(entry)) {
        return entry.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      }
      if (typeof entry === "string" && entry.trim().length > 0) {
        return entry
          .split(/[,\s]+/)
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }
    return [];
  } catch {
    return [];
  }
}

function extractPermissionCodes(authorities: string[] | undefined): string[] {
  if (!authorities || authorities.length === 0) return [];
  return authorities
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !value.startsWith("ROLE_"));
}

export default function ChatbotNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlView = searchParams.get("view");

  const derivedView: "chat" | "search" | "analytics" =
    urlView === "analytics" ? "analytics" : urlView === "search" ? "search" : "chat";

  const [activeView, setActiveView] = useState<"chat" | "search" | "analytics">(derivedView);
  useEffect(() => {
    setActiveView(derivedView);
  }, [derivedView]);

  const currentUser = getStoredUser();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [permissionsHydrated, setPermissionsHydrated] = useState(false);
  const roleCodes = useMemo(
    () => (currentUser?.roles ?? []).map((role) => role.toUpperCase()),
    [currentUser?.roles]
  );
  const isPrivilegedRole = useMemo(
    () =>
      roleCodes.some(
        (role) =>
          role.includes("TENANT_ADMIN") ||
          role.includes("SUPER_ADMIN") ||
          role.includes("STAFF")
      ),
    [roleCodes]
  );

  const hasPermission = useCallback(
    (code: string) => {
      if (isPrivilegedRole) return true;
      const normalized = code.toUpperCase();
      const perms = userPermissions.map((p) => p.toUpperCase());
      if (perms.includes(normalized)) return true;
      if (normalized.startsWith("DOCUMENT_") && perms.includes("DOCUMENT_ALL")) return true;
      if (normalized.startsWith("ANALYTICS_") && perms.includes("ANALYTICS_EXPORT")) return true;
      return false;
    },
    [isPrivilegedRole, userPermissions]
  );

  const normalizedPermissions = useMemo(
    () => userPermissions.map((permission) => permission.toUpperCase()),
    [userPermissions]
  );
  const hasDocumentAll = normalizedPermissions.includes("DOCUMENT_ALL");
  const hasAnyDocumentPermission =
    hasDocumentAll ||
    normalizedPermissions.includes("DOCUMENT_READ") ||
    normalizedPermissions.includes("DOCUMENT_WRITE") ||
    normalizedPermissions.includes("DOCUMENT_DELETE");
  const canViewDocuments = hasAnyDocumentPermission;
  const canViewAnalytics = hasPermission("ANALYTICS_VIEW");

  const documentPermissionTabs = useMemo(() => {
    const tabs: string[] = [];
    if (hasDocumentAll || normalizedPermissions.includes("DOCUMENT_READ")) {
      tabs.push("DOCUMENT_READ");
    }
    if (hasDocumentAll || normalizedPermissions.includes("DOCUMENT_WRITE")) {
      tabs.push("DOCUMENT_WRITE");
    }
    if (hasDocumentAll || normalizedPermissions.includes("DOCUMENT_DELETE")) {
      tabs.push("DOCUMENT_DELETE");
    }
    return tabs;
  }, [hasDocumentAll, normalizedPermissions]);

  const isChatHistoryOpen = useWorkspaceStore((state) => state.isChatHistoryOpen);
  const setChatHistoryOpen = useWorkspaceStore((state) => state.setChatHistoryOpen);
  const toggleChatHistory = useWorkspaceStore((state) => state.toggleChatHistory);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchNavKey, setSearchNavKey] = useState(0);

  const goToSearch = useCallback(
    (query?: string) => {
      if (!canViewDocuments) return;
      setSearchQuery(query ?? "");
      setSearchNavKey((k) => k + 1);
      setChatHistoryOpen(false);
      router.push("/chatbot-new?view=search");
    },
    [canViewDocuments, router, setChatHistoryOpen]
  );

  const loadPermissions = useCallback(async () => {
    try {
      await tryRefreshAuth();
      let resolvedPermissions: string[] = [];
      const latestStoredUser = getStoredUser();
      const storedAuthorities = extractPermissionCodes(latestStoredUser?.roles);
      if (storedAuthorities.length > 0) {
        resolvedPermissions = storedAuthorities;
      }

      try {
        const permissions = await getCurrentUserPermissions();
        if (permissions.length > 0) {
          resolvedPermissions = permissions;
        }
      } catch {
        // fallback below
      }

      if (resolvedPermissions.length === 0) {
        try {
          const profile = await getProfile();
          const profilePermissions = (profile.permissions ?? []).filter(Boolean);
          if (profilePermissions.length > 0) {
            resolvedPermissions = profilePermissions;
          }
        } catch {
          // fallback below
        }
      }

      if (resolvedPermissions.length === 0) {
        const jwtPermissions = decodePermissionsFromJwt(getAccessToken());
        if (jwtPermissions.length > 0) {
          resolvedPermissions = jwtPermissions;
        }
      }

      setUserPermissions(resolvedPermissions);
    } finally {
      setPermissionsHydrated(true);
    }
  }, []);

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  useLivePolling(
    () => loadPermissions(),
    { enabled: true, intervalMs: 1500, hiddenIntervalMs: 3500, runImmediately: false }
  );

  useEffect(() => {
    if (!permissionsHydrated) return;
    if (activeView === "analytics" && !canViewAnalytics) {
      router.replace("/chatbot-new");
      return;
    }
    if (activeView === "search" && !canViewDocuments) {
      router.replace("/chatbot-new");
    }
  }, [activeView, canViewAnalytics, canViewDocuments, permissionsHydrated, router]);

  return (
    <>
      <ChatbotNewHeader onSmartSearch={() => goToSearch()} />

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
        {!permissionsHydrated ? (
          <ChatbotEntryLoading variant="embedded" />
        ) : (
          <>
            {activeView === "chat" && (
              <ChatView
                isHistoryOpen={isChatHistoryOpen}
                onToggleHistory={toggleChatHistory}
                onNavigateToSearch={(query) => goToSearch(query)}
              />
            )}
            {activeView === "search" && canViewDocuments && (
              <SearchView
                key={`${searchNavKey}-${searchQuery}`}
                initialQuery={searchQuery}
                permissionTabs={documentPermissionTabs}
              />
            )}
            {activeView === "analytics" && canViewAnalytics && <ChatbotAnalyticsView />}
          </>
        )}
      </div>
    </>
  );
}
