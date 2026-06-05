"use client";

import { useState, useEffect } from "react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import {
  FileText,
  Upload,
  FolderTree,
  Tag as TagIcon,
  Plus,
  Edit2,
  Trash2,
  Hash,
  Ban,
  Check,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirmDialog } from "@/components/ui";
import { toast } from "@/components/ui/AlertProvider";
import { 
  listTagsManage, 
  deleteTag, 
  activateTag, 
  deactivateTag,
  createTag,
  updateTag,
} from "@/lib/api/tags";
import type { DocumentTagResponse } from "@/types/knowledge";
import { X } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
  documentCount?: number;
}

// Transform API response to local Tag type
function transformTag(tag: DocumentTagResponse): Tag {
  return {
    id: tag.id,
    name: tag.name,
    code: tag.code,
    description: tag.description ?? null,
    status: tag.isActive === false ? "INACTIVE" : "ACTIVE", // Backend uses isActive boolean
    documentCount: undefined, // API doesn't return this yet
  };
}

type TagFormErrors = {
  name?: string;
  code?: string;
  description?: string;
};

function TagModal({
  isOpen,
  onClose,
  tag,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag | null;
  onSuccess: () => void;
}) {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<TagFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const baseFieldClass =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-white";
  const normalFieldClass =
    "border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700";
  const errorFieldClass =
    "border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500";

  const getFieldClassName = (hasError: boolean) =>
    `${baseFieldClass} ${hasError ? errorFieldClass : normalFieldClass}`;

  const validateForm = (): TagFormErrors => {
    const nextErrors: TagFormErrors = {};
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      nextErrors.name = isEn ? "Name is required" : "Tên là bắt buộc";
    }

    if (!trimmedCode) {
      nextErrors.code = isEn ? "Code is required" : "Mã là bắt buộc";
    } else if (/\s/.test(code)) {
      nextErrors.code = isEn
        ? "Code cannot contain spaces"
        : "Mã không được chứa khoảng trắng";
    }

    if (description.trim().length > 1000) {
      nextErrors.description = isEn
        ? "Description must be at most 1000 characters"
        : "Mô tả tối đa 1000 ký tự";
    }

    return nextErrors;
  };

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setCode(tag.code);
      setDescription(tag.description ?? "");
    } else {
      setName("");
      setCode("");
      setDescription("");
    }

    setErrors({});
    setSubmitError(null);
  }, [tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const trimmedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();
    const normalizedDescription = description.trim();

    setSaving(true);
    try {
      if (tag) {
        // Update
        await updateTag(tag.id, {
          name: trimmedName,
          code: normalizedCode || tag.code,
          description: normalizedDescription || null,
          isActive: tag.status === "ACTIVE",
        });
      } else {
        // Create
        await createTag({
          name: trimmedName,
          code: normalizedCode || "AUTO",
          description: normalizedDescription || null,
        });
      }
      onSuccess();
      onClose();
    } catch (e) {
      const fallbackMessage = isEn ? "Failed to save tag" : "Lưu tag thất bại";
      const message = e instanceof Error && e.message ? e.message : fallbackMessage;
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            {tag
              ? isEn ? "Edit Tag" : "Sửa tag"
              : isEn ? "Create Tag" : "Tạo tag"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-white">
                {isEn ? "Name" : "Tên"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const value = e.target.value;
                  setName(value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                aria-invalid={errors.name ? "true" : "false"}
                className={getFieldClassName(!!errors.name)}
                placeholder={isEn ? "Enter tag name" : "Nhập tên tag"}
              />
              {errors.name ? (
                <p className="mt-1 text-xs text-red-500">{errors.name}</p>
              ) : null}
            </div>

            {/* Code */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-white">
                {isEn ? "Code" : "Mã"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const value = e.target.value;
                  setCode(value);

                  setErrors((prev) => ({
                    ...prev,
                    code: /\s/.test(value)
                      ? isEn
                        ? "Code cannot contain spaces"
                        : "Mã không được chứa khoảng trắng"
                      : undefined,
                  }));
                }}
                aria-invalid={errors.code ? "true" : "false"}
                className={getFieldClassName(!!errors.code)}
                placeholder={isEn ? "Auto-generated if empty" : "Tự động tạo nếu để trống"}
              />
              {errors.code ? (
                <p className="mt-1 text-xs text-red-500">{errors.code}</p>
              ) : null}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-white">
                {isEn ? "Description" : "Mô tả"}
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  const value = e.target.value;
                  setDescription(value);
                  setErrors((prev) => ({
                    ...prev,
                    description:
                      value.trim().length > 1000
                        ? isEn
                          ? "Description must be at most 1000 characters"
                          : "Mô tả tối đa 1000 ký tự"
                        : undefined,
                  }));
                }}
                rows={3}
                aria-invalid={errors.description ? "true" : "false"}
                className={getFieldClassName(!!errors.description)}
                placeholder={isEn ? "Enter description (optional)" : "Nhập mô tả (tùy chọn)"}
              />
              {errors.description ? (
                <p className="mt-1 text-xs text-red-500">{errors.description}</p>
              ) : null}
            </div>
          </div>

          {submitError ? (
            <p className="mt-3 text-sm text-red-500">{submitError}</p>
          ) : null}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {isEn ? "Cancel" : "Hủy"}
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? (isEn ? "Saving..." : "Đang lưu...") : isEn ? "Save" : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TagCard({ 
  tag,
  onEdit,
  onDelete,
  onToggleStatus,
  deleting = false,
}: { 
  tag: Tag;
  onEdit: (tag: Tag) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (tag: Tag) => void;
  deleting?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const { language } = useLanguageStore();
  const isEn = language === "en";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Icon */}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-sm">
        <Hash className="h-5 w-5" />
      </div>

      {/* Name */}
      <h3 className="mb-1 text-base font-semibold text-zinc-900 dark:text-white">
        {tag.name}
      </h3>

      {/* Stats */}
      {tag.documentCount !== undefined && (
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          {tag.documentCount} {isEn ? "documents" : "tài liệu"}
        </p>
      )}

      {/* Status Badge */}
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
          tag.status === "ACTIVE"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}
      >
        {tag.status === "ACTIVE" ? (isEn ? "Active" : "Hoạt động") : (isEn ? "Inactive" : "Không hoạt động")}
      </span>

      {/* Actions */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <button 
              onClick={() => onEdit(tag)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button 
              onClick={() => onToggleStatus(tag)}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                tag.status === "ACTIVE"
                  ? "text-zinc-600 hover:bg-amber-100 hover:text-amber-600 dark:text-zinc-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-400"
                  : "text-zinc-600 hover:bg-emerald-100 hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
              }`}
              title={tag.status === "ACTIVE" ? (isEn ? "Deactivate" : "Vô hiệu hóa") : (isEn ? "Activate" : "Kích hoạt")}
            >
              {tag.status === "ACTIVE" ? (
                <Ban className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button 
              onClick={() => onDelete(tag.id)}
              disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DocumentsNavigation() {
  const pathname = usePathname();
  const { language } = useLanguageStore();
  const t = translations[language];

  const navItems = [
    { href: "/tenant-admin/documents", label: t.documents, icon: FileText },
    { href: "/tenant-admin/documents-upload", label: language === "en" ? "Upload" : "Đăng tải", icon: Upload },
    { href: "/tenant-admin/categories", label: t.categories, icon: FolderTree },
    { href: "/tenant-admin/tags", label: t.tags, icon: TagIcon },
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

export default function TagsPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  const { confirm: confirmAction, confirmDialog } = useConfirmDialog();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTags = async () => {
    setLoading(true);
    try {
      const data = await listTagsManage();
      setTags(data.map(transformTag));
    } catch (e) {
      console.error("Failed to load tags:", e);
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: isEn ? "Delete tag permanently?" : "Xóa vĩnh viễn tag?",
      description: isEn
        ? "This action cannot be undone."
        : "Hành động này không thể hoàn tác.",
      confirmText: isEn ? "Delete" : "Xóa",
      cancelText: isEn ? "Cancel" : "Hủy",
      tone: "danger",
    });
    if (!ok) return;
    
    setDeletingId(id);
    try {
      await deleteTag(id);
      await loadTags();
    } catch (e) {
      toast.error(isEn ? "Failed to delete tag" : "Xóa tag thất bại");
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (tag: Tag) => {
    if (tag.status === "ACTIVE") {
      const ok = await confirmAction({
        title: isEn ? "Deactivate tag?" : "Vô hiệu hóa tag?",
        description: isEn
          ? "This tag will be hidden from active lists."
          : "Tag sẽ ẩn khỏi danh sách active.",
        confirmText: isEn ? "Deactivate" : "Vô hiệu hóa",
        cancelText: isEn ? "Cancel" : "Hủy",
        tone: "warning",
      });
      if (!ok) return;
    } else {
      const ok = await confirmAction({
        title: isEn ? "Activate tag?" : "Kích hoạt tag?",
        description: isEn
          ? "This tag will appear again in active lists."
          : "Tag sẽ xuất hiện lại trong danh sách active.",
        confirmText: isEn ? "Activate" : "Kích hoạt",
        cancelText: isEn ? "Cancel" : "Hủy",
        tone: "default",
      });
      if (!ok) return;
    }

    try {
      if (tag.status === "ACTIVE") {
        await deactivateTag(tag.id);
      } else {
        await activateTag(tag.id);
      }
      await loadTags();
    } catch (e) {
      toast.error(isEn ? "Failed to update status" : "Cập nhật trạng thái thất bại");
      console.error(e);
    }
  };

  return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t.tags}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {isEn
              ? "Label and categorize documents with tags for easy filtering"
              : "Gắn nhãn và phân loại tài liệu bằng tags để lọc dễ dàng"}
          </p>
        </div>

        {/* Navigation */}
        <DocumentsNavigation />

        {/* Toolbar */}
        <div className="flex items-center justify-end">
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {isEn ? "Create Tag" : "Tạo tag"}
          </button>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-600 dark:border-zinc-800 dark:border-t-emerald-400" />
            </div>
          ) : tags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                <TagIcon className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {isEn ? "No tags yet" : "Chưa có tags"}
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {isEn
                  ? "Create your first tag to label documents"
                  : "Tạo tag đầu tiên để gắn nhãn tài liệu"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tags.map((tag) => (
                <TagCard 
                  key={tag.id} 
                  tag={tag}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleStatus={handleToggleStatus}
                  deleting={deletingId === tag.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        <TagModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTag(null);
          }}
          tag={editingTag}
          onSuccess={loadTags}
        />

        {confirmDialog}
      </div>
  );
}

