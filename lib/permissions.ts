/** Permission metadata from BE (tenant custom roles / staff onboarding). */
export type PermissionOption = {
  code: string;
  nameEn?: string;
  nameVi?: string;
};

export type PermissionCategoryDto = {
  category?: string;
  permissions?: { code: string; name?: string; description?: string }[];
};

export function flattenPermissionCategories(
  categories: PermissionCategoryDto[]
): PermissionOption[] {
  const flat: PermissionOption[] = [];
  categories.forEach((category) => {
    category.permissions?.forEach((permission) => {
      flat.push({
        code: permission.code,
        nameEn: permission.name,
        nameVi: permission.description,
      });
    });
  });
  return flat;
}

export function buildPermissionLabelMap(
  options: PermissionOption[]
): Map<string, PermissionOption> {
  return new Map(options.map((item) => [item.code, item]));
}

/** Quyền tenant có thể gán — dùng khi API chưa sẵn sàng hoặc lỗi mạng */
export const DEFAULT_TENANT_PERMISSION_CATEGORIES: PermissionCategoryDto[] = [
  {
    category: "User Management",
    permissions: [{ code: "USER_READ", name: "View users", description: "Xem người dùng" }],
  },
  {
    category: "Department Management",
    permissions: [{ code: "DEPT_READ", name: "View departments", description: "Xem phòng ban" }],
  },
  {
    category: "Document Management",
    permissions: [
      { code: "DOCUMENT_READ", name: "View documents", description: "Xem tài liệu" },
      { code: "DOCUMENT_WRITE", name: "Upload/Edit documents", description: "Tải lên/cập nhật tài liệu" },
      { code: "DOCUMENT_DELETE", name: "Delete documents", description: "Xóa tài liệu" },
      { code: "DOCUMENT_ALL", name: "All document permissions", description: "Toàn quyền tài liệu" },
    ],
  },
  {
    category: "Profile",
    permissions: [
      { code: "PROFILE_MANAGE", name: "Manage own profile", description: "Quản lý hồ sơ cá nhân" },
    ],
  },
  {
    category: "Analytics",
    permissions: [
      { code: "ANALYTICS_VIEW", name: "View analytics", description: "Xem phân tích" },
    ],
  },
];

export function resolveTenantPermissionCategories(
  fromApi: PermissionCategoryDto[]
): PermissionCategoryDto[] {
  const hasAny = fromApi.some((category) => (category.permissions?.length ?? 0) > 0);
  return hasAny ? fromApi : DEFAULT_TENANT_PERMISSION_CATEGORIES;
}
