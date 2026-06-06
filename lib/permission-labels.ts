import type { PermissionOption } from "@/lib/permissions";

/** Bilingual labels for tenant permission codes (matches backend authorities). */
export const PERMISSION_LABELS: Record<string, { vi: string; en: string }> = {
  USER_ALL: { vi: "Toàn quyền người dùng", en: "Full user access" },
  USER_READ: { vi: "Xem người dùng", en: "View users" },
  USER_WRITE: { vi: "Thêm/sửa người dùng", en: "Create/update users" },
  USER_DELETE: { vi: "Xóa người dùng", en: "Delete users" },
  DEPT_READ: { vi: "Xem phòng ban", en: "View departments" },
  DEPT_WRITE: { vi: "Thêm/sửa phòng ban", en: "Create/update departments" },
  DEPT_DELETE: { vi: "Xóa phòng ban", en: "Delete departments" },
  DEPT_ALL: { vi: "Toàn quyền phòng ban", en: "Full department access" },
  ROLE_ALL: { vi: "Toàn quyền vai trò", en: "Full role access" },
  ROLE_READ: { vi: "Xem vai trò", en: "View roles" },
  ROLE_WRITE: { vi: "Thêm/sửa vai trò", en: "Create/update roles" },
  DOCUMENT_ALL: { vi: "Toàn quyền tài liệu", en: "Full document access" },
  DOCUMENT_READ: { vi: "Xem tài liệu", en: "View documents" },
  DOCUMENT_WRITE: { vi: "Tải lên/cập nhật tài liệu", en: "Upload/update documents" },
  DOCUMENT_DELETE: { vi: "Xóa tài liệu", en: "Delete documents" },
  PROFILE_MANAGE: { vi: "Quản lý hồ sơ cá nhân", en: "Manage own profile" },
  ANALYTICS_VIEW: { vi: "Xem phân tích", en: "View analytics" },
  ANALYTICS_EXPORT: { vi: "Xuất báo cáo phân tích", en: "Export analytics" },
  SUBSCRIPTION_READ: { vi: "Xem gói đăng ký", en: "View subscription" },
  SUBSCRIPTION_WRITE: { vi: "Quản lý gói đăng ký", en: "Manage subscription" },
  SUBSCRIPTION_MANAGE: { vi: "Quản lý gói đăng ký", en: "Manage subscription" },
};

export const PERMISSION_CATEGORY_LABELS: Record<string, { vi: string; en: string }> = {
  "User Management": { vi: "Quản lý người dùng", en: "User Management" },
  "Department Management": { vi: "Quản lý phòng ban", en: "Department Management" },
  "Document Management": { vi: "Quản lý tài liệu", en: "Document Management" },
  Profile: { vi: "Hồ sơ cá nhân", en: "Profile" },
  Analytics: { vi: "Phân tích", en: "Analytics" },
};

export function getPermissionCategoryLabel(category: string, lang: "vi" | "en"): string {
  const row = PERMISSION_CATEGORY_LABELS[category];
  if (row) return lang === "en" ? row.en : row.vi;
  return category;
}

export function getPermissionLabel(
  code: string,
  source: string | PermissionOption | undefined,
  lang: "vi" | "en"
): string {
  const row = PERMISSION_LABELS[code];
  if (row) return lang === "en" ? row.en : row.vi;

  if (typeof source === "string" && source.trim()) {
    return source.trim();
  }

  if (source && typeof source === "object") {
    if (lang === "en" && source.nameEn?.trim()) return source.nameEn.trim();
    if (lang === "vi" && source.nameVi?.trim()) return source.nameVi.trim();
    if (source.nameEn?.trim()) return source.nameEn.trim();
  }

  return code;
}
