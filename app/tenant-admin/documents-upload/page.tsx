"use client";

import { useState, useEffect } from "react";
import { DocumentUploadCard } from "@/components/tenant-admin/DocumentUploadCard";
import { listCategoriesFlat } from "@/lib/api/categories";
import { listTagsActive } from "@/lib/api/tags";
import { uploadDocument, listAccessScopeDepartments, listAccessScopeRoles, type UploadDocumentParams } from "@/lib/api/documents";
import type { DocumentCategoryResponse, DocumentTagResponse } from "@/types/knowledge";
import type { DepartmentResponse, RoleResponse } from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { useRouter, usePathname } from "next/navigation";
import { FileText, Upload, FolderTree, Tag } from "lucide-react";
import Link from "next/link";

function DocumentsNavigation() {
  const pathname = usePathname();
  const { language } = useLanguageStore();
  const t = translations[language];

  const navItems = [
    { href: "/tenant-admin/documents", label: t.documents, icon: FileText },
    { href: "/tenant-admin/documents-upload", label: language === "en" ? "Upload" : "Đăng tải", icon: Upload },
    { href: "/tenant-admin/categories", label: t.categories, icon: FolderTree },
    { href: "/tenant-admin/tags", label: t.tags, icon: Tag },
  ];

  return (
    <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function DocumentsUploadPage() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";

  const [categories, setCategories] = useState<DocumentCategoryResponse[]>([]);
  const [tags, setTags] = useState<DocumentTagResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cats, activeTags, depts, tenantRoles] = await Promise.all([
          listCategoriesFlat(),
          listTagsActive(),
          listAccessScopeDepartments().catch(() => []),
          listAccessScopeRoles().catch(() => []),
        ]);
        setCategories(cats);
        setTags(activeTags);
        setDepartments(depts);
        setRoles(tenantRoles);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  const handleUpload = async (data: {
    file: File;
    categoryId?: string;
    tagIds: string[];
    description?: string;
    visibility: "COMPANY_WIDE" | "SPECIFIC_DEPARTMENTS" | "SPECIFIC_ROLES" | "SPECIFIC_DEPARTMENTS_AND_ROLES";
    departmentIds: number[];
    roleIds: number[];
    minimumRoleLevel: number;
  }) => {
    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const params: UploadDocumentParams = {
        file: data.file,
        categoryId: data.categoryId || null,
        tagIds: data.tagIds.length ? data.tagIds : null,
        description: data.description || null,
        minimumRoleLevel: data.minimumRoleLevel,
        visibility: data.visibility,
        accessibleDepartments: data.departmentIds.length ? data.departmentIds : null,
        accessibleRoles: data.roleIds.length ? data.roleIds : null,
      };

      await uploadDocument(params);
      setSuccess(true);
      
      // Redirect to documents page after 2 seconds
      setTimeout(() => {
        router.push("/tenant-admin/documents");
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {isEn ? "Loading..." : "Đang tải..."}
            </p>
          </div>
        </div>
    );
  }

  return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isEn ? "Upload Document" : "Tải lên tài liệu"}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {isEn
              ? "Upload a new document to your knowledge base"
              : "Tải lên tài liệu mới vào cơ sở tri thức"}
          </p>
        </div>

        {/* Navigation */}
        <DocumentsNavigation />

        {/* Error Message */}
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            {isEn
              ? "Document uploaded successfully! Redirecting..."
              : "Tải lên tài liệu thành công! Đang chuyển hướng..."}
          </div>
        )}

        {/* Upload Card */}
        <DocumentUploadCard
          categories={categories}
          tags={tags}
          departments={departments}
          roles={roles}
          uploading={uploading}
          onUpload={handleUpload}
        />
      </div>
  );
}

