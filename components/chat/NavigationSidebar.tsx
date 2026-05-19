"use client";

import { useState, useEffect } from "react";
import {
  Search,
  MessageSquare,
  FileText,
  Users,
  User,
  LogOut,
  ClipboardCheck,
  ArrowLeft,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguageStore } from "@/lib/language-store";
import {
  clearAuth,
  getAccessToken,
  getStoredUser,
  tryRefreshAuth,
} from "@/lib/auth-store";
import { logout } from "@/lib/api/auth";
import { getProfile } from "@/lib/api/profile";
import { ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";
import { AppLogo } from "@/components/brand/AppLogo";

export type ChatbotNavView = "chat" | "search" | "analytics";

interface NavigationSidebarProps {
  activeView: ChatbotNavView | null;
  onViewChange: (view: ChatbotNavView) => void;
  onToggleHistory: () => void;
  canViewDocuments?: boolean;
  canViewAnalytics?: boolean;
  showOnboardingShortcut?: boolean;
  onboardingLoading?: boolean;
  onboardingTotal?: number;
  onboardingCompleted?: number;
  onboardingHasIncomplete?: boolean;
  onOpenOnboarding?: () => void;
  isDocumentDashboardActive?: boolean;
  onOpenSettings?: () => void;
  readOnlyNavigation?: boolean;
}

export function NavigationSidebar({
  activeView,
  onViewChange,
  onToggleHistory,
  canViewDocuments = true,
  canViewAnalytics = true,
  showOnboardingShortcut = false,
  onboardingLoading = false,
  onboardingTotal = 0,
  onboardingCompleted = 0,
  onboardingHasIncomplete = false,
  onOpenOnboarding,
  isDocumentDashboardActive = false,
  onOpenSettings,
  readOnlyNavigation = false,
}: NavigationSidebarProps) {
  const { language } = useLanguageStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const currentUser = getStoredUser();
  const [authorities, setAuthorities] = useState<string[]>(() => {
    const user = getStoredUser() as (ReturnType<typeof getStoredUser> & { permissions?: string[] }) | null;
    return Array.from(new Set([...(user?.roles ?? []), ...(user?.permissions ?? [])]));
  });
  const [displayName, setDisplayName] = useState(
    currentUser?.email?.split("@")[0] || "User"
  );
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await tryRefreshAuth();
      if (cancelled) return;
      const refreshedUser = getStoredUser() as (ReturnType<typeof getStoredUser> & { permissions?: string[] }) | null;
      const mergedAuthorities = Array.from(
        new Set([...(refreshedUser?.roles ?? []), ...(refreshedUser?.permissions ?? [])])
      );
      setAuthorities(mergedAuthorities);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p?.fullName?.trim()) setDisplayName(p.fullName.trim());
        setTenantLogoUrl(p?.tenantLogoUrl ?? null);
        setTenantName(p?.tenantName ?? null);
        const profileAuthorities = Array.isArray(p?.permissions) ? p.permissions.filter(Boolean) : [];
        if (profileAuthorities.length > 0) {
          setAuthorities((prev) => Array.from(new Set([...prev, ...profileAuthorities])));
        }
      })
      .catch(() => {});
  }, []);

  const isEn = language === "en";
  const hasDocumentReadPermission = authorities.some(
    (authority) =>
      authority === "DOCUMENT_READ" ||
      authority === "DOCUMENT_ALL" ||
      authority === "ALL"
  );
  const hasDocumentWritePermission = authorities.some(
    (authority) =>
      authority === "DOCUMENT_WRITE" ||
      authority === "DOCUMENT_ALL" ||
      authority === "ALL"
  );
  const hasDocumentDashboardShortcut = hasDocumentReadPermission && hasDocumentWritePermission;
  const isTenantAdmin = authorities.some((authority) =>
    authority.includes("TENANT_ADMIN")
  );

  const navigation: {
    id: ChatbotNavView;
    icon: typeof MessageSquare;
    caption: string;
  }[] = [
    { id: "chat", icon: MessageSquare, caption: isEn ? "Chat" : "Tr\u00f2 chuy\u1ec7n" },
    ...(canViewDocuments
      ? [{ id: "search" as const, icon: Search, caption: isEn ? "Documents" : "T\u00e0i li\u1ec7u" }]
      : []),
    ...(canViewAnalytics
      ? [{ id: "analytics" as const, icon: Users, caption: isEn ? "Analytics" : "Ph\u00e2n t\u00edch" }]
      : []),
  ];

  const handleLogout = async () => {
    const token = getAccessToken();
    try {
      if (token) await logout(token);
    } catch {
      // Ignore API/logout transport failures; client-side sign-out still proceeds.
    } finally {
      clearAuth();
      router.replace("/login");
      router.refresh();
    }
  };

  const nameInitial =
    displayName.trim().charAt(0).toUpperCase() ||
    currentUser?.email?.charAt(0).toUpperCase() ||
    "?";

  return (
    <aside className="relative z-50 flex h-full min-h-0 w-16 shrink-0 flex-col items-stretch border-r border-zinc-200 bg-white py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto mb-4 flex shrink-0 flex-col items-center gap-2">
        <AppLogo
          size={36}
          tenantLogoUrl={tenantLogoUrl}
          tenantName={tenantName}
          className="rounded-lg bg-white shadow-sm"
        />
        <div
          className="group relative flex shrink-0 cursor-default flex-col items-center gap-1"
          title={displayName}
          aria-label={displayName}
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <span className="text-sm font-bold">{nameInitial}</span>
          </div>
          <span className="pointer-events-none absolute left-full top-1/2 z-[60] ml-2 max-w-[14rem] -translate-y-1/2 truncate rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-zinc-700">
            {displayName}
          </span>
        </div>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col items-center justify-start gap-2.5 px-1 pt-2"
        aria-label={isEn ? "Main navigation" : "\u0110i\u1ec1u h\u01b0\u1edbng ch\u00ednh"}
      >
        {navigation.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (readOnlyNavigation) return;
                if (item.id === "chat") {
                  onToggleHistory();
                  onViewChange("chat");
                  return;
                }
                onViewChange(item.id);
              }}
              disabled={readOnlyNavigation}
              title={item.caption}
              className={`group flex flex-col items-center gap-1 border-0 bg-transparent p-0 transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 dark:focus-visible:ring-offset-zinc-950 ${readOnlyNavigation ? "cursor-default opacity-90" : "hover:-translate-y-0.5"}`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "scale-105 bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/90 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-700/80"
                    : readOnlyNavigation
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-zinc-600 group-hover:bg-zinc-100 dark:text-zinc-400 dark:group-hover:bg-zinc-900"
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} />
              </span>
              <span
                className={`max-w-[3.75rem] text-center text-[8px] font-medium leading-tight tracking-tight ${
                  isActive ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {item.caption}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-3 border-t border-zinc-200/90 pt-3 dark:border-zinc-800">
        {hasDocumentDashboardShortcut && !isTenantAdmin ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => readOnlyNavigation ? undefined : router.push("/document-dashboard")}
              disabled={readOnlyNavigation}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                isDocumentDashboardActive
                  ? "scale-105 bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/90 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-700/80"
                  : "text-zinc-600 hover:-translate-y-0.5 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
              title={isEn ? "Document dashboard" : "B\u1ea3ng \u0111i\u1ec1u khi\u1ec3n t\u00e0i li\u1ec7u"}
            >
              <FileText className="h-5 w-5" />
            </button>
            <span
              className={`max-w-[3.75rem] text-center text-[8px] font-medium leading-tight ${
                isDocumentDashboardActive
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {isEn ? "Document Dashboard" : "B\u1ea3ng \u0111i\u1ec1u khi\u1ec3n t\u00e0i li\u1ec7u"}
            </span>
          </div>
        ) : null}

        {showOnboardingShortcut ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={readOnlyNavigation ? undefined : onOpenOnboarding}
              disabled={readOnlyNavigation || onboardingLoading || onboardingTotal === 0}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                onboardingHasIncomplete
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              title={
                onboardingLoading
                  ? isEn
                    ? "Loading onboarding..."
                    : "\u0110ang t\u1ea3i onboarding..."
                  : onboardingTotal > 0
                    ? `Onboarding ${onboardingCompleted}/${onboardingTotal}`
                    : isEn
                      ? "Onboarding not configured"
                      : "Onboarding ch\u01b0a c\u1ea5u h\u00ecnh"
              }
            >
              {onboardingLoading ? (
                <ChatbotSpinner size="xs" />
              ) : (
                <ClipboardCheck className="h-5 w-5" />
              )}
              {!onboardingLoading && onboardingHasIncomplete ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" />
              ) : null}
            </button>
            <span className="max-w-[3.75rem] text-center text-[8px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
              {isEn ? "Checklist" : "Danh s\u00e1ch"}
            </span>
          </div>
        ) : null}

        {isTenantAdmin ? (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => readOnlyNavigation ? undefined : router.push("/tenant-admin")}
              disabled={readOnlyNavigation}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              title={isEn ? "Back to dashboard" : "Quay l\u1ea1i dashboard"}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="max-w-[3.75rem] text-center text-[8px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
              {isEn ? "Dashboard" : "Dashboard"}
            </span>
          </div>
        ) : null}

        <div className="relative flex flex-col items-center gap-1 pb-1">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex size-10 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            title={mounted ? displayName : "User"}
          >
            <User className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
          </button>
          <span className="max-w-[3.75rem] text-center text-[8px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
            {isEn ? "Account" : "H\u1ed3 s\u01a1"}
          </span>

          {showUserMenu ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40"
                aria-label="Close menu"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute bottom-full left-full z-50 mb-2 ml-2 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">{displayName}</div>
                  <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{currentUser?.email}</div>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/profile");
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <User className="h-4 w-4" />
                    {isEn ? "Profile" : "H\u1ed3 s\u01a1"}
                  </button>
                  {onOpenSettings ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSettings();
                      }}
                      className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Settings className="h-4 w-4" />
                      {isEn ? "Settings" : "C\u00e0i \u0111\u1eb7t"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="h-4 w-4" />
                    {isEn ? "Logout" : "\u0110\u0103ng xu\u1ea5t"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
