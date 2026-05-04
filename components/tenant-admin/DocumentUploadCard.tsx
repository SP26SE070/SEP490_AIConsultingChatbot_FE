"use client";

import { useState, useRef } from "react";
import { Upload, X, FileText } from "lucide-react";
import type { DocumentCategoryResponse, DocumentTagResponse, DocumentVisibility } from "@/types/knowledge";
import type { DepartmentResponse, RoleResponse } from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";

interface DocumentUploadCardProps {
  categories: DocumentCategoryResponse[];
  tags: DocumentTagResponse[];
  departments: DepartmentResponse[];
  roles: RoleResponse[];
  uploading: boolean;
  onUpload: (data: {
    file: File;
    categoryId?: string;
    tagIds: string[];
    description?: string;
    visibility: DocumentVisibility;
    departmentIds: number[];
    roleIds: number[];
  }) => Promise<void>;
  onUploadNewVersion: (data: {
    documentId: string;
    file: File;
  }) => Promise<void>;
}

type DuplicateUploadError = Error & {
  code?: string;
  existingDocumentId?: string;
  existingDocumentTitle?: string;
};

function getVisibilityLabels(language: "vi" | "en"): Record<DocumentVisibility, string> {
  if (language === "en") {
    return {
      COMPANY_WIDE: "Company-wide",
      SPECIFIC_DEPARTMENTS: "Specific departments",
      SPECIFIC_ROLES: "Specific roles",
      SPECIFIC_DEPARTMENTS_AND_ROLES: "Specific departments AND roles",
    };
  }

  return {
    COMPANY_WIDE: "Toàn công ty",
    SPECIFIC_DEPARTMENTS: "Theo phòng ban",
    SPECIFIC_ROLES: "Theo vai trò",
    SPECIFIC_DEPARTMENTS_AND_ROLES: "Theo phòng ban VÀ vai trò",
  };
}

export function DocumentUploadCard({
  categories,
  tags,
  departments,
  roles,
  uploading,
  onUpload,
  onUploadNewVersion,
}: DocumentUploadCardProps) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  const visibilityLabels = getVisibilityLabels(language);
  const availableDepartments = departments.filter((d) => Number.isFinite(d.id) && d.id > 0);
  const availableRoles = roles.filter((r) => Number.isFinite(r.id) && r.id > 0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<DocumentVisibility>("COMPANY_WIDE");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingDocumentId: string;
    existingDocumentTitle: string;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
      setError(null);
      setDuplicateInfo(null);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'ppt':
      case 'pptx':
        return '📽️';
      case 'txt':
      case 'md':
        return '📃';
      case 'csv':
        return '📋';
      default:
        return '📎';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateInfo(null);
    if (!selectedFile) {
      setError(isEn ? "Please select a file first." : "Vui lòng chọn tệp trước.");
      return;
    }

    const allowedExtensions = new Set(["pdf", "docx", "xlsx", "pptx", "txt", "md", "csv"]);
    const ext = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(ext)) {
      setError(
        isEn
          ? "Unsupported file type. Allowed: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV."
          : "Định dạng không hỗ trợ. Chỉ chấp nhận: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV."
      );
      return;
    }

    const maxFileSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxFileSize) {
      setError(isEn ? "File size exceeds 50MB limit." : "Dung lượng tệp vượt quá giới hạn 50MB.");
      return;
    }

    if (
      (visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") &&
      selectedDepartmentIds.length === 0
    ) {
      setError(isEn ? "Please select at least one department." : "Vui lòng chọn ít nhất một phòng ban.");
      return;
    }

    if (
      (visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") &&
      selectedRoleIds.length === 0
    ) {
      setError(isEn ? "Please select at least one role." : "Vui lòng chọn ít nhất một vai trò.");
      return;
    }

    if (
      (visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") &&
      availableDepartments.length === 0
    ) {
      setError(
        isEn
          ? "No active departments available for this access scope."
          : "Không có phòng ban hoạt động để áp dụng phạm vi truy cập này."
      );
      return;
    }

    if (
      (visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") &&
      availableRoles.length === 0
    ) {
      setError(
        isEn
          ? "No active roles available for this access scope."
          : "Không có vai trò hoạt động để áp dụng phạm vi truy cập này."
      );
      return;
    }

    try {
      await onUpload({
        file: selectedFile,
        categoryId: categoryId || undefined,
        tagIds: selectedTagIds,
        description: description || undefined,
        visibility,
        departmentIds: selectedDepartmentIds,
        roleIds: selectedRoleIds,
      });

      // Reset form
      setSelectedFile(null);
      setCategoryId("");
      setSelectedTagIds([]);
      setDescription("");
      setVisibility("COMPANY_WIDE");
      setSelectedDepartmentIds([]);
      setSelectedRoleIds([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e) {
      const duplicateError = e as DuplicateUploadError;
      if (
        duplicateError?.code === "DUPLICATE_DOCUMENT" &&
        typeof duplicateError.existingDocumentId === "string" &&
        duplicateError.existingDocumentId.length > 0
      ) {
        setDuplicateInfo({
          existingDocumentId: duplicateError.existingDocumentId,
          existingDocumentTitle:
            duplicateError.existingDocumentTitle?.trim() || selectedFile.name,
        });
        return;
      }
      setError(e instanceof Error ? e.message : isEn ? "Upload failed." : "Tải lên thất bại.");
    }
  };

  const handleConfirmUploadNewVersion = async () => {
    if (!selectedFile || !duplicateInfo) return;
    setError(null);
    try {
      await onUploadNewVersion({
        documentId: duplicateInfo.existingDocumentId,
        file: selectedFile,
      });
      setDuplicateInfo(null);
      setSelectedFile(null);
      setCategoryId("");
      setSelectedTagIds([]);
      setDescription("");
      setVisibility("COMPANY_WIDE");
      setSelectedDepartmentIds([]);
      setSelectedRoleIds([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Update failed." : "Cập nhật thất bại.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
        {duplicateInfo && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold">
              {isEn ? "This file already exists." : "Tệp này đã tồn tại."}
            </p>
            <p className="mt-1">
              {isEn ? "Document:" : "Tài liệu:"} <span className="font-medium">{duplicateInfo.existingDocumentTitle}</span>
            </p>
            <p className="mt-2 text-xs">
              {isEn ? "Selected access scope for this upload:" : "Phạm vi truy cập đã chọn cho lần tải này:"}
            </p>
            <p className="mt-1 text-xs font-medium">
              {visibilityLabels[visibility]}
            </p>
            {(visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
              <p className="mt-1 text-xs">
                {isEn ? "Departments:" : "Phòng ban:"}{" "}
                {selectedDepartmentIds.length}
              </p>
            )}
            {(visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
              <p className="mt-1 text-xs">
                {isEn ? "Roles:" : "Vai trò:"}{" "}
                {selectedRoleIds.length}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={handleConfirmUploadNewVersion}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {isEn ? "Upload as new version" : "Tải lên thành phiên bản mới"}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateInfo(null)}
                className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                {isEn ? "Cancel" : "Hủy"}
              </button>
            </div>
          </div>
        )}
        {/* Upload Section */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-white">
            {isEn ? "Upload Document" : "Tải lên tài liệu"}
          </h3>

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all ${
              isDragging
                ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-950/30"
                : selectedFile
                  ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-700 dark:bg-emerald-950/20"
                  : "border-zinc-300 bg-zinc-50/50 hover:border-emerald-400 hover:bg-emerald-50/30 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-transform group-hover:scale-110 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Upload className="h-8 w-8" />
                </div>
                <p className="mb-2 text-base font-medium text-zinc-900 dark:text-white">
                  {isEn ? "Drag & drop your file here" : "Kéo thả tệp vào đây"}
                </p>
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {isEn ? "or click to browse" : "hoặc nhấp để chọn"}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  {isEn
                    ? "PDF, DOCX, XLSX, PPTX, TXT, MD, CSV (max 50MB)"
                    : "PDF, DOCX, XLSX, PPTX, TXT, MD, CSV (tối đa 50MB)"}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-3xl shadow-sm dark:bg-zinc-800">
                  {getFileIcon(selectedFile.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Section */}
        {selectedFile && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-white">
              {isEn ? "Document Details" : "Chi tiết tài liệu"}
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Category */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.category}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">{t.noCategory}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Access Scope */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.accessScope}
                </label>
                <select
                  value={visibility}
                  onChange={(e) => {
                    const v = e.target.value as DocumentVisibility;
                    setVisibility(v);
                    if (v !== "SPECIFIC_DEPARTMENTS" && v !== "SPECIFIC_DEPARTMENTS_AND_ROLES") setSelectedDepartmentIds([]);
                    if (v !== "SPECIFIC_ROLES" && v !== "SPECIFIC_DEPARTMENTS_AND_ROLES") setSelectedRoleIds([]);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {Object.entries(visibilityLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t.description}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={isEn ? "Add a description (optional)" : "Thêm mô tả (tùy chọn)"}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
              />
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.tags}
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTagIds((prev) =>
                            prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Departments */}
            {(visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.selectDepartments}
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableDepartments.map((d) => {
                    const active = selectedDepartmentIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDepartmentIds((prev) =>
                            prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                          );
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {d.name ?? d.code ?? d.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Roles */}
            {(visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.selectRoles}
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map((r) => {
                    const active = selectedRoleIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoleIds((prev) =>
                            prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                          );
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {r.name ?? r.code ?? r.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Section */}
        {selectedFile && (
          <div className="sticky bottom-0 z-10 mt-2 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
            <button
              type="submit"
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              {uploading
                ? isEn ? "Uploading..." : "Đang tải lên..."
                : isEn ? "Upload Document" : "Tải lên tài liệu"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
