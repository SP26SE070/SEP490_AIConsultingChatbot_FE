"use client";

import { useState, useEffect } from "react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import {
  FileText,
  Upload,
  FolderTree,
  Tag,
  Plus,
  Ban,
  Check,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  FolderOpen,
  Folder,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirmDialog } from "@/components/ui";
import { toast } from "@/components/ui/AlertProvider";
import { 
  listCategoriesTree,
  listCategoriesManage,
  deleteCategoryPermanently, 
  activateCategory, 
  deactivateCategory,
  createCategory,
  updateCategory,
} from "@/lib/api/categories";
import type { DocumentCategoryResponse } from "@/types/knowledge";
import { X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  parentId: string | null;
  children?: Category[];
}

function hasActiveDescendants(category: Category): boolean {
  if (!category.children || category.children.length === 0) {
    return false;
  }

  return category.children.some(
    (child) => child.status === "ACTIVE" || hasActiveDescendants(child)
  );
}

// Transform API response to local Category type
function transformCategory(cat: DocumentCategoryResponse): Category {
  return {
    id: cat.id,
    name: cat.name,
    code: cat.code,
    status: cat.isActive === false ? "INACTIVE" : "ACTIVE", // Backend uses isActive boolean
    parentId: cat.parentId || null,
    children: cat.children?.map(transformCategory),
  };
}

function CategoryModal({
  isOpen,
  onClose,
  category,
  allCategories,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  allCategories: Category[];
  onSuccess: () => void;
}) {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setCode(category.code);
      setDescription(""); // Description không có trong response
      setParentId(category.parentId || "");
    } else {
      setName("");
      setCode("");
      setDescription("");
      setParentId("");
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (category) {
        // Update
        await updateCategory(category.id, {
          name: name.trim(),
          code: code.trim() || category.code,
          description: description.trim() || undefined,
          parentId: parentId || null,
          isActive: category.status === "ACTIVE",
        });
      } else {
        // Create
        await createCategory({
          name: name.trim(),
          code: code.trim() || "AUTO",
          description: description.trim() || undefined,
          parentId: parentId || null,
        });
      }
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(isEn ? "Failed to save category" : "Lưu danh mục thất bại");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Flatten categories for parent selection
  const flattenCategories = (cats: Category[], level = 0): Array<{ id: string; name: string; level: number }> => {
    const result: Array<{ id: string; name: string; level: number }> = [];
    cats.forEach((cat) => {
      // Don't show the category being edited as a parent option
      if (!category || cat.id !== category.id) {
        result.push({ id: cat.id, name: cat.name, level });
        if (cat.children) {
          result.push(...flattenCategories(cat.children, level + 1));
        }
      }
    });
    return result;
  };

  const parentOptions = flattenCategories(allCategories);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            {category
              ? isEn ? "Edit Category" : "Sửa danh mục"
              : isEn ? "Create Category" : "Tạo danh mục"}
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
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                placeholder={isEn ? "Enter category name" : "Nhập tên danh mục"}
              />
            </div>

            {/* Code */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-white">
                {isEn ? "Code" : "Mã"}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                placeholder={isEn ? "Auto-generated if empty" : "Tự động tạo nếu để trống"}
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-white">
                {isEn ? "Description" : "Mô tả"}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                placeholder={isEn ? "Enter description (optional)" : "Nhập mô tả (tùy chọn)"}
              />
            </div>

            {/* Parent Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-white">
                {isEn ? "Parent Category" : "Danh mục cha"}
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              >
                <option value="">{isEn ? "None (Root level)" : "Không có (Cấp gốc)"}</option>
                {parentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {"—".repeat(opt.level)} {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

function CategoryTreeItem({ 
  category, 
  level = 0,
  onEdit,
  onDelete,
  onToggleStatus,
  deleting = false,
}: { 
  category: Category; 
  level?: number;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (category: Category) => void;
  deleting?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div>
      <div
        className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="h-5 w-5" />
        )}

        {/* Icon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-4 w-4" />
          ) : (
            <Folder className="h-4 w-4" />
          )}
        </div>

        {/* Name */}
        <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-white">
          {category.name}
        </span>

        {/* Status Badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            category.status === "ACTIVE"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {category.status === "ACTIVE" ? "Active" : "Inactive"}
        </span>

        {/* Actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1"
            >
              <button 
                onClick={() => onEdit(category)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={() => onToggleStatus(category)}
                className={`flex h-7 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition ${
                  category.status === "ACTIVE"
                    ? "text-zinc-500 hover:bg-amber-100 hover:text-amber-600 dark:text-zinc-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-400"
                    : "text-zinc-500 hover:bg-emerald-100 hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
                }`}
                title={
                  category.status === "ACTIVE"
                    ? isEn ? "Deactivate" : "Vô hiệu hóa"
                    : isEn ? "Activate" : "Kích hoạt"
                }
              >
                {category.status === "ACTIVE" ? (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    <span>{isEn ? "Deactivate" : "Vô hiệu hóa"}</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>{isEn ? "Activate" : "Kích hoạt"}</span>
                  </>
                )}
              </button>
              <button 
                onClick={() => onDelete(category.id)}
                disabled={deleting}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {category.children!.map((child) => (
              <CategoryTreeItem 
                key={child.id} 
                category={child} 
                level={level + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleStatus={onToggleStatus}
                deleting={deleting}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

export default function CategoriesPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  const { confirm: confirmAction, confirmDialog } = useConfirmDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      // Use /manage endpoint to get all categories (active + inactive)
      const data = await listCategoriesManage();
      
      // Build tree structure from flat list
      const buildTree = (items: DocumentCategoryResponse[]): Category[] => {
        const map = new Map<string, Category>();
        const roots: Category[] = [];

        // First pass: create all nodes
        items.forEach((item) => {
          map.set(item.id, transformCategory(item));
        });

        // Second pass: build tree
        items.forEach((item) => {
          const node = map.get(item.id)!;
          if (item.parentId && map.has(item.parentId)) {
            const parent = map.get(item.parentId)!;
            if (!parent.children) parent.children = [];
            parent.children.push(node);
          } else {
            roots.push(node);
          }
        });

        return roots;
      };

      setCategories(buildTree(data));
    } catch (e) {
      console.error("Failed to load categories:", e);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: isEn ? "Delete category permanently?" : "Xóa vĩnh viễn danh mục?",
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
      await deleteCategoryPermanently(id);
      await loadCategories();
    } catch (e) {
      toast.error(isEn ? "Failed to delete category" : "Xóa danh mục thất bại");
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (category: Category) => {
    if (category.status === "ACTIVE" && hasActiveDescendants(category)) {
      toast.warning(
        isEn
          ? "Cannot deactivate this category while it still has active sub-categories. Please deactivate or move child categories first."
          : "Không thể vô hiệu hóa danh mục này khi vẫn còn danh mục con đang active. Vui lòng vô hiệu hóa hoặc di chuyển danh mục con trước."
      );
      return;
    }

    if (category.status === "ACTIVE") {
      const ok = await confirmAction({
        title: isEn ? "Deactivate category?" : "Vô hiệu hóa danh mục?",
        description: isEn
          ? "This category will be hidden from active lists."
          : "Danh mục sẽ ẩn khỏi danh sách active.",
        confirmText: isEn ? "Deactivate" : "Vô hiệu hóa",
        cancelText: isEn ? "Cancel" : "Hủy",
        tone: "warning",
      });
      if (!ok) return;
    } else {
      const ok = await confirmAction({
        title: isEn ? "Activate category?" : "Kích hoạt danh mục?",
        description: isEn
          ? "This category will appear again in active lists."
          : "Danh mục sẽ xuất hiện lại trong danh sách active.",
        confirmText: isEn ? "Activate" : "Kích hoạt",
        cancelText: isEn ? "Cancel" : "Hủy",
        tone: "default",
      });
      if (!ok) return;
    }

    try {
      if (category.status === "ACTIVE") {
        await deactivateCategory(category.id);
      } else {
        await activateCategory(category.id);
      }
      await loadCategories();
    } catch (e) {
      const fallbackMessage = isEn ? "Failed to update status" : "Cập nhật trạng thái thất bại";
      const errorMessage = e instanceof Error && e.message ? e.message : fallbackMessage;
      toast.error(errorMessage);
    }
  };

  return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t.categories}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {isEn
              ? "Organize your documents into hierarchical categories"
              : "Tổ chức tài liệu của bạn thành các danh mục phân cấp"}
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
            {isEn ? "Create Category" : "Tạo danh mục"}
          </button>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-600 dark:border-zinc-800 dark:border-t-emerald-400" />
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                <FolderTree className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {isEn ? "No categories yet" : "Chưa có danh mục"}
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {isEn
                  ? "Create your first category to organize documents"
                  : "Tạo danh mục đầu tiên để tổ chức tài liệu"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map((category) => (
                <CategoryTreeItem 
                  key={category.id} 
                  category={category}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleStatus={handleToggleStatus}
                  deleting={deletingId === category.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        <CategoryModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
          }}
          category={editingCategory}
          allCategories={categories}
          onSuccess={loadCategories}
        />

        {confirmDialog}
      </div>
  );
}

