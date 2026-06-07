"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Upload, Sparkles, FileText, ShieldCheck } from "lucide-react";
import { DocumentsTab } from "@/components/tenant-admin/DocumentsTab";
import { DocumentUploadCard } from "@/components/tenant-admin/DocumentUploadCard";
import { listCategoriesFlat } from "@/lib/api/categories";
import { listTagsActive } from "@/lib/api/tags";
import { uploadDocument, uploadNewVersion, listDocuments, listAccessScopeDepartments, listAccessScopeRoles, type UploadDocumentParams } from "@/lib/api/documents";
import { getStoredUser, tryRefreshAuth } from "@/lib/auth-store";
import { getCurrentUserPermissions, getProfile } from "@/lib/api/profile";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import type { DocumentCategoryResponse, DocumentTagResponse } from "@/types/knowledge";
import type { DepartmentResponse, RoleResponse } from "@/lib/api/tenant-admin";
import { useLivePolling } from "@/lib/hooks/useLivePolling";

const READ_DOCUMENT_AUTHORITIES = ["DOCUMENT_READ", "DOCUMENT_ALL", "ALL"] as const;
const MANAGE_DOCUMENT_AUTHORITIES = ["DOCUMENT_WRITE", "DOCUMENT_ALL", "ALL"] as const;
const DELETE_DOCUMENT_AUTHORITIES = ["DOCUMENT_DELETE", "DOCUMENT_ALL", "ALL"] as const;

function hasAnyAuthority(authorities: string[], required: readonly string[]): boolean {
  return authorities.some((authority) => required.includes(authority as (typeof required)[number]));
}

/**
 * Sub-navigation between Documents library and Upload card.
 * The top-level tab bar lives in the shared workspace layout; this secondary nav is kept
 * so "Upload" stays discoverable when the top tab bar overflow-scrolls on narrow screens.
 */
function DocumentsSubNav({
  activeTab,
  canManageDocuments,
}: {
  activeTab: "documents" | "upload";
  canManageDocuments: boolean;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];

  return (
    <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        href="/document-dashboard"
        className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
          activeTab === "documents"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        }`}
      >
        <FileText className="h-4 w-4" />
        {language === "en" ? "Documents" : "Tài liệu"}
      </Link>

      {canManageDocuments && (
        <Link
          href="/document-dashboard?mode=upload"
          className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === "upload"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <Upload className="h-4 w-4" />
          {language === "en" ? "Upload" : "Đăng tải"}
        </Link>
      )}
    </div>
  );
}

function UploadSkeleton() {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-40 animate-pulse rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

/**
 * DocumentDashboardPage is rendered inside the shared workspace shell.
 * It must NOT create its own chrome (sidebar/tab bar) — the layout owns that.
 */
export default function DocumentDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguageStore();
  const [hydrated, setHydrated] = useState(false);
  const [authorities, setAuthorities] = useState<string[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryResponse[]>([]);
  const [tags, setTags] = useState<DocumentTagResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [uploading, setUploading] = useState(false);

  const syncAuthorities = useMemo(
    () => async () => {
      await tryRefreshAuth();
      const stored = getStoredUser();
      const roleAuthorities = (stored?.roles ?? []).filter(Boolean);

      let permissionAuthorities: string[] = [];
      try {
        permissionAuthorities = await getCurrentUserPermissions();
      } catch {
        try {
          const profile = await getProfile();
          permissionAuthorities = (profile.permissions ?? []).filter(Boolean);
        } catch {
          permissionAuthorities = [];
        }
      }

      const merged = Array.from(
        new Set([...roleAuthorities, ...permissionAuthorities].map((v) => v.trim()).filter(Boolean))
      );
      setAuthorities(merged);
      setHydrated(true);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await syncAuthorities();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [syncAuthorities]);

  useLivePolling(
    () => syncAuthorities(),
    { enabled: true, intervalMs: 1200, hiddenIntervalMs: 3000, runImmediately: true }
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [cats, activeTags, depts, tenantRoles] = await Promise.all([
          listCategoriesFlat(),
          listTagsActive(),
          listAccessScopeDepartments().catch(() => []),
          listAccessScopeRoles().catch(() => []),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setTags(activeTags);
        setDepartments(depts);
        setRoles(tenantRoles);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canReadDocuments = useMemo(
    () => hasAnyAuthority(authorities, READ_DOCUMENT_AUTHORITIES),
    [authorities]
  );
  const canManageDocuments = useMemo(
    () => hasAnyAuthority(authorities, MANAGE_DOCUMENT_AUTHORITIES),
    [authorities]
  );
  const canDeleteDocuments = useMemo(
    () => hasAnyAuthority(authorities, DELETE_DOCUMENT_AUTHORITIES),
    [authorities]
  );
  const activeTab: "documents" | "upload" =
    searchParams.get("mode") === "upload" ? "upload" : "documents";

  useEffect(() => {
    if (!hydrated) return;
    if (!canManageDocuments && activeTab === "upload") router.replace("/document-dashboard");
  }, [activeTab, canManageDocuments, hydrated, router]);

  useEffect(() => {
    if (!hydrated || canReadDocuments) return;
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/chatbot-new");
  }, [canReadDocuments, hydrated, router]);

  const buildDuplicateUploadError = (
    existingDocumentId: string,
    existingDocumentTitle: string,
    message: string
  ): Error & { code: string; existingDocumentId: string; existingDocumentTitle: string } => {
    const err = new Error(message) as Error & {
      code: string;
      existingDocumentId: string;
      existingDocumentTitle: string;
    };
    err.code = "DUPLICATE_DOCUMENT";
    err.existingDocumentId = existingDocumentId;
    err.existingDocumentTitle = existingDocumentTitle;
    return err;
  };

  const handleUpload = async (data: {
    file: File;
    categoryId?: string;
    tagIds: string[];
    description?: string;
    visibility: "COMPANY_WIDE" | "SPECIFIC_DEPARTMENTS" | "SPECIFIC_ROLES" | "SPECIFIC_DEPARTMENTS_AND_ROLES";
    departmentIds: number[];
    roleIds: number[];
  }) => {
    setUploading(true);
    try {
      const params: UploadDocumentParams = {
        file: data.file,
        categoryId: data.categoryId || null,
        tagIds: data.tagIds.length ? data.tagIds : null,
        description: data.description || null,
        visibility: data.visibility,
        accessibleDepartments: data.departmentIds.length ? data.departmentIds : null,
        accessibleRoles: data.roleIds.length ? data.roleIds : null,
      };
      await uploadDocument(params);
      router.replace("/document-dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : language === "en" ? "Upload failed" : "Tải lên thất bại";
      const normalized = message.toLowerCase();
      const isDuplicate =
        normalized.includes("already exists") ||
        normalized.includes("duplicate") ||
        normalized.includes("đã tồn tại") ||
        normalized.includes("trùng");
      if (isDuplicate) {
        const docs = await listDocuments().catch(() => ({ items: [] }));
        const matched = docs.items.find((doc) => {
          const title = (doc.documentTitle ?? "").trim().toLowerCase();
          const original = (doc.originalFileName ?? "").trim().toLowerCase();
          const fileName = data.file.name.trim().toLowerCase();
          return fileName.length > 0 && (title === fileName || original === fileName);
        });
        if (matched) {
          throw buildDuplicateUploadError(
            matched.id,
            matched.documentTitle || matched.originalFileName,
            language === "en"
              ? "This file already exists. You can upload it as a new version."
              : "Tệp đã tồn tại. Bạn có thể tải lên thành phiên bản mới."
          );
        }
      }
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadNewVersionFromDuplicate = async (data: {
    documentId: string;
    file: File;
  }) => {
    setUploading(true);
    try {
      await uploadNewVersion({
        documentId: data.documentId,
        file: data.file,
      });
      router.replace("/document-dashboard");
    } finally {
      setUploading(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-500" />
      </div>
    );
  }

  if (!canReadDocuments) {
    return null;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 lg:space-y-8 lg:p-6">
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 shadow-xl shadow-emerald-500/10 dark:border-zinc-800">
          <div className="grid gap-6 p-6 text-white md:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                {language === "en" ? "Document Dashboard" : "Bảng điều khiển tài liệu"}
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                {language === "en" ? "Document Dashboard" : "Bảng điều khiển tài liệu"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90 md:text-base">
                {language === "en"
                  ? "Browse, search, and manage company knowledge with a clean workspace that matches the app design system."
                  : "Duyệt, tìm kiếm và quản lý tri thức công ty trong không gian làm việc đồng bộ với giao diện tổng thể."}
              </p>
            </div>
            <div className="flex flex-wrap items-start justify-end gap-3 lg:justify-end">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  {language === "en" ? "Permission-aware" : "Theo quyền truy cập"}
                </div>
                <p className="mt-1 text-xs text-white/80">
                  {language === "en"
                    ? "Read access is always available; upload appears only for writers."
                    : "Chỉ hiện upload cho role có quyền ghi."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <DocumentsSubNav activeTab={activeTab} canManageDocuments={canManageDocuments} />

        <div key={activeTab} className="animate-view-enter">
          {activeTab === "upload" ? (
            canManageDocuments ? (
              loadingMeta ? (
                <UploadSkeleton />
              ) : (
                <DocumentUploadCard
                  categories={categories}
                  tags={tags}
                  departments={departments}
                  roles={roles}
                  uploading={uploading}
                  onUpload={handleUpload}
                  onUploadNewVersion={handleUploadNewVersionFromDuplicate}
                />
              )
            ) : null
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <DocumentsTab 
                mode="library" 
                hideEditActions={!canManageDocuments && !canDeleteDocuments} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
