"use client";

import { useState, useEffect } from "react";
import { 
  Filter, 
  UserPlus, 
  Eye, 
  Pencil, 
  UserCheck, 
  UserX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  User,
  Mail,
  Building,
  Calendar,
  Info,
  Key,
  Shield,
  MoreVertical,
  Trash2,
  Check
} from "lucide-react";
import { 
  getTenantUsers, 
  getTenantRoles, 
  getTenantUserById,
  getTenantDepartments,
  updateTenantUser,
  activateTenantUser,
  deactivateTenantUser,
  resetTenantUserPassword,
  updateTenantUserPermissions,
  getTenantAvailablePermissions,
  deleteTenantUser,
  type UserResponse, 
  type RoleResponse,
  type DepartmentResponse,
  type UpdateUserRequest
} from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getStoredUser } from "@/lib/auth-store";
import { mergeRolesWithCache, readTenantRolesCache } from "@/lib/tenant-roles-cache";
import { useConfirmDialog } from "@/components/ui";
import { getPermissionLabel } from "@/lib/permission-labels";

const ROLE_CODES_EXCLUDED_FROM_USER_ASSIGNMENT = new Set(["TENANT_ADMIN", "SUPER_ADMIN", "STAFF"]);

interface EmployeeManagementNewProps {
  onOpenCreate?: () => void;
  onActionSuccess?: (message: string) => void;
  onActionError?: (message: string) => void;
}

export function EmployeeManagementNew({ onOpenCreate, onActionSuccess, onActionError }: EmployeeManagementNewProps) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  const { confirm, confirmDialog } = useConfirmDialog();

  // Data states
  const [employees, setEmployees] = useState<UserResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const [roleFilter, setRoleFilter] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal states
  const [detailUser, setDetailUser] = useState<UserResponse | null>(null);
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [permissionUser, setPermissionUser] = useState<UserResponse | null>(null);
  const [availablePermissions, setAvailablePermissions] = useState<{ code: string; name?: string }[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [permissionMetaLoading, setPermissionMetaLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Menu states
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersData, rolesData] = await Promise.all([
          getTenantUsers(statusFilter, roleFilter ? { roleId: roleFilter } : undefined),
          getTenantRoles().catch(() => []),
        ]);
        
        // Filter out Tenant Administrators
        const filtered = usersData.filter((u) => {
          const roleName = (u.roleName ?? "").toLowerCase();
          return !roleName.includes("tenant admin");
        });
        
        setEmployees(filtered);
        setRoles(rolesData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load employees");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [statusFilter, roleFilter]);

  // Pagination
  const totalPages = Math.ceil(employees.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEmployees = employees.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, roleFilter]);

  // Close menu on scroll/resize
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => {
      setOpenMenuId(null);
      setMenuPos(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openMenuId]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  };

  const toggleMenu = (userId: string, anchor: HTMLElement) => {
    if (openMenuId === userId) {
      setOpenMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 320;
    const margin = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, margin),
      window.innerWidth - margin - menuWidth
    );
    const menuGap = 2;
    const openDownTop = rect.bottom + menuGap;
    const openUpTop = rect.top - menuHeight - menuGap;
    const top =
      openDownTop + menuHeight > window.innerHeight - margin
        ? Math.max(margin, openUpTop)
        : openDownTop;
    setMenuPos({ top, left });
    setOpenMenuId(userId);
  };

  // Action handlers
  const handleViewDetail = async (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    try {
      const user = await getTenantUserById(userId);
      setDetailUser(user);
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to load user details" : "Không thể tải thông tin người dùng"));
    }
  };

  const handleEdit = (user: UserResponse) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setEditUser(user);
  };

  const handleActivate = async (userId: string) => {
    const ok = await confirm({
      title: isEn ? "Activate employee?" : "Kích hoạt nhân viên?",
      description: isEn 
        ? "This employee will be able to access the system again." 
        : "Nhân viên này sẽ có thể truy cập hệ thống trở lại.",
      confirmText: isEn ? "Activate" : "Kích hoạt",
      cancelText: t.cancel,
      tone: "default",
    });
    if (!ok) return;

    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    try {
      await activateTenantUser(userId);
      onActionSuccess?.(isEn ? "User activated successfully" : "Kích hoạt người dùng thành công");
      // Reload data
      const usersData = await getTenantUsers(statusFilter, roleFilter ? { roleId: roleFilter } : undefined);
      const filtered = usersData.filter((u) => {
        const roleName = (u.roleName ?? "").toLowerCase();
        return !roleName.includes("tenant admin");
      });
      setEmployees(filtered);
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to activate user" : "Không thể kích hoạt người dùng"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (userId: string) => {
    const ok = await confirm({
      title: isEn ? "Deactivate employee?" : "Vô hiệu hóa nhân viên?",
      description: isEn 
        ? "This employee will no longer be able to access the system. You can reactivate them later." 
        : "Nhân viên này sẽ không thể truy cập hệ thống nữa. Bạn có thể kích hoạt lại sau.",
      confirmText: isEn ? "Deactivate" : "Vô hiệu hóa",
      cancelText: t.cancel,
      tone: "danger",
    });
    if (!ok) return;

    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    try {
      await deactivateTenantUser(userId);
      onActionSuccess?.(isEn ? "User deactivated successfully" : "Vô hiệu hóa người dùng thành công");
      // Reload data
      const usersData = await getTenantUsers(statusFilter, roleFilter ? { roleId: roleFilter } : undefined);
      const filtered = usersData.filter((u) => {
        const roleName = (u.roleName ?? "").toLowerCase();
        return !roleName.includes("tenant admin");
      });
      setEmployees(filtered);
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to deactivate user" : "Không thể vô hiệu hóa người dùng"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async (userId: string, body: UpdateUserRequest) => {
    setActionLoading(userId);
    try {
      await updateTenantUser(userId, body);
      setEditUser(null);
      onActionSuccess?.(isEn ? "User updated successfully" : "Cập nhật người dùng thành công");
      // Reload data
      const usersData = await getTenantUsers(statusFilter, roleFilter ? { roleId: roleFilter } : undefined);
      const filtered = usersData.filter((u) => {
        const roleName = (u.roleName ?? "").toLowerCase();
        return !roleName.includes("tenant admin");
      });
      setEmployees(filtered);
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to update user" : "Không thể cập nhật người dùng"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    const ok = await confirm({
      title: isEn ? "Reset password?" : "Đặt lại mật khẩu?",
      description: isEn 
        ? "A password reset email will be sent to this employee." 
        : "Email đặt lại mật khẩu sẽ được gửi đến nhân viên này.",
      confirmText: isEn ? "Send Reset Email" : "Gửi Email",
      cancelText: t.cancel,
      tone: "default",
    });
    if (!ok) return;

    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    try {
      await resetTenantUserPassword(userId);
      onActionSuccess?.(isEn ? "Password reset email sent successfully" : "Đã gửi email đặt lại mật khẩu thành công");
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to send reset email" : "Không thể gửi email đặt lại mật khẩu"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPermissionEditor = async (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setPermissionMetaLoading(true);
    try {
      const [userDetail, permissions, rolesData] = await Promise.all([
        getTenantUserById(userId),
        getTenantAvailablePermissions(),
        getTenantRoles(),
      ]);

      // Get role permissions (these are read-only)
      const userRolePermissions: string[] = [];
      if (userDetail.roleId) {
        const userRole = rolesData.find((r) => r.id === userDetail.roleId);
        if (userRole?.permissions) {
          userRolePermissions.push(...userRole.permissions);
        }
      }

      // Combine role permissions with user's direct permissions
      const userDirectPermissions = ((userDetail as unknown as { permissions?: string[] }).permissions ?? []).filter(Boolean);
      const allSelectedPermissions = [...new Set([...userRolePermissions, ...userDirectPermissions])];

      setPermissionUser(userDetail);
      setAvailablePermissions(permissions);
      setSelectedPermissions(allSelectedPermissions);
      setRolePermissions(userRolePermissions);
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to load permissions" : "Không thể tải quyền"));
    } finally {
      setPermissionMetaLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    const ok = await confirm({
      title: isEn ? "Remove employee from organization?" : "Xóa nhân viên khỏi tổ chức?",
      description: isEn 
        ? "This action cannot be undone. The employee will be permanently removed from your organization." 
        : "Hành động này không thể hoàn tác. Nhân viên sẽ bị xóa vĩnh viễn khỏi tổ chức của bạn.",
      confirmText: isEn ? "Remove" : "Xóa",
      cancelText: t.cancel,
      tone: "danger",
    });
    if (!ok) return;

    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    try {
      await deleteTenantUser(userId);
      onActionSuccess?.(isEn ? "Employee removed successfully" : "Đã xóa nhân viên thành công");
      // Reload data
      const usersData = await getTenantUsers(statusFilter, roleFilter ? { roleId: roleFilter } : undefined);
      const filtered = usersData.filter((u) => {
        const roleName = (u.roleName ?? "").toLowerCase();
        return !roleName.includes("tenant admin");
      });
      setEmployees(filtered);
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to remove employee" : "Không thể xóa nhân viên"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSavePermissions = async () => {
    if (!permissionUser) return;
    setActionLoading(permissionUser.id);
    try {
      await updateTenantUserPermissions(permissionUser.id, selectedPermissions);
      setPermissionUser(null);
      onActionSuccess?.(isEn ? "Permissions updated successfully" : "Cập nhật quyền thành công");
      // Reload data
      const usersData = await getTenantUsers(statusFilter, roleFilter ? { roleId: roleFilter } : undefined);
      const filtered = usersData.filter((u) => {
        const roleName = (u.roleName ?? "").toLowerCase();
        return !roleName.includes("tenant admin");
      });
      setEmployees(filtered);
    } catch (e) {
      onActionError?.(e instanceof Error ? e.message : (isEn ? "Failed to update permissions" : "Không thể cập nhật quyền"));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {isEn ? "Employee Management" : "Quản lý Nhân viên"}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {isEn ? "Manage employees in your organization" : "Quản lý nhân viên trong tổ chức của bạn"}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter Button */}
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            showFilters || roleFilter !== null || statusFilter !== "ACTIVE"
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          <Filter className="h-4 w-4" />
          {isEn ? "Filters" : "Bộ lọc"}
        </button>

        {/* Add Employee */}
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/40"
        >
          <UserPlus className="h-4 w-4" />
          {t.addEmployee}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {isEn ? "Status:" : "Trạng thái:"}
              </label>
              <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
                {(["ACTIVE", "INACTIVE", "ALL"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {status === "ACTIVE"
                      ? isEn ? "Active" : "Hoạt động"
                      : status === "INACTIVE"
                        ? isEn ? "Inactive" : "Không hoạt động"
                        : isEn ? "All" : "Tất cả"}
                  </button>
                ))}
              </div>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {isEn ? "Role:" : "Vai trò:"}
              </label>
              <select
                value={roleFilter ?? ""}
                onChange={(e) => setRoleFilter(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">{isEn ? "All roles" : "Tất cả vai trò"}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset */}
            {(roleFilter !== null || statusFilter !== "ACTIVE") && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ACTIVE");
                  setRoleFilter(null);
                }}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {isEn ? "Reset filters" : "Đặt lại"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <UserPlus className="h-8 w-8 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {isEn ? "No employees found" : "Không tìm thấy nhân viên"}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {isEn ? "Try adjusting your filters" : "Thử điều chỉnh bộ lọc"}
            </p>
          </div>
        ) : (
          <>
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isEn ? "Employee" : "Nhân viên"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isEn ? "Role" : "Vai trò"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isEn ? "Status" : "Trạng thái"}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isEn ? "Actions" : "Thao tác"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {paginatedEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    {/* Employee Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-cyan-500 text-sm font-semibold text-white">
                          {getInitials(employee.fullName ?? employee.email ?? "")}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                            {employee.fullName || employee.email}
                          </p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {employee.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {employee.roleName || "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(
                          employee.isActive ?? false
                        )}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${employee.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
                        {employee.isActive
                          ? isEn ? "Active" : "Hoạt động"
                          : isEn ? "Inactive" : "Không hoạt động"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="relative px-6 py-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => toggleMenu(employee.id, e.currentTarget)}
                          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-500 dark:hover:bg-zinc-800"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {actionLoading === employee.id && (
                          <span className="absolute right-14 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span>
                  {isEn ? "Showing" : "Hiển thị"} {startIndex + 1}-{Math.min(endIndex, employees.length)} {isEn ? "of" : "trong"} {employees.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dropdown Menu */}
      {openMenuId && menuPos && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpenMenuId(null);
              setMenuPos(null);
            }}
          />
          <div
            className="fixed z-50 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={() => handleViewDetail(openMenuId)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Eye className="h-4 w-4" /> {t.viewDetail}
            </button>
            <button
              type="button"
              onClick={() => {
                const selected = employees.find((u) => u.id === openMenuId);
                if (selected) handleEdit(selected);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" /> {t.updateUserInfo}
            </button>
            <button
              type="button"
              onClick={() => void handleOpenPermissionEditor(openMenuId)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Key className="h-4 w-4" /> {t.updateUserPermissions}
            </button>
            {employees.find((u) => u.id === openMenuId)?.isActive ? (
              <button
                type="button"
                onClick={() => handleDeactivate(openMenuId)}
                disabled={!!actionLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:text-amber-400 dark:hover:bg-amber-950/30"
              >
                <UserX className="h-4 w-4" /> {t.deactivate}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleActivate(openMenuId)}
                disabled={!!actionLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                <UserCheck className="h-4 w-4" /> {t.activate}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleResetPassword(openMenuId)}
              disabled={!!actionLoading}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Key className="h-4 w-4" /> {t.resetPassword}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(openMenuId)}
              disabled={!!actionLoading}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-4 w-4" /> {t.deleteUser}
            </button>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {detailUser && (
        <DetailModal user={detailUser} onClose={() => setDetailUser(null)} />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={(body) => handleSaveEdit(editUser.id, body)}
          loading={actionLoading === editUser.id}
        />
      )}

      {/* Permissions Modal */}
      {permissionUser && (
        <UpdatePermissionsModal
          user={permissionUser}
          permissions={availablePermissions}
          selected={selectedPermissions}
          setSelected={setSelectedPermissions}
          rolePermissions={rolePermissions}
          loading={permissionMetaLoading || actionLoading === permissionUser.id}
          onClose={() => setPermissionUser(null)}
          onSave={handleSavePermissions}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDialog}
    </div>
  );
}

// Detail Modal Component
function DetailModal({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  const userPermissions = (user.permissions ?? []).filter((code) => Boolean(code));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-zinc-950">
        <div className="relative overflow-hidden rounded-t-3xl bg-linear-to-br from-emerald-500 to-cyan-600 px-6 py-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
                <User className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{t.userDetail}</h3>
                <p className="mt-1 text-sm text-emerald-100">{isEn ? "Employee Information" : "Thông tin nhân viên"}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800">
                <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-white">{isEn ? "User Information" : "Thông tin người dùng"}</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                  <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.fullName}</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{user.fullName ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                  <Info className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.status}</p>
                  <p className="mt-0.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${user.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                      {user.isActive ? t.active : t.inactive}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800">
                <Mail className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-white">{isEn ? "Contact Information" : "Thông tin liên hệ"}</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                  <Mail className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.email}</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-white">{user.email ?? "—"}</p>
                </div>
              </div>
              {user.contactEmail && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                    <Mail className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.contactEmail}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-white">{user.contactEmail}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800">
                <Building className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-white">{isEn ? "Organization Information" : "Thông tin tổ chức"}</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                  <Building className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.department}</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{user.departmentName ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                  <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.role}</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{user.roleName ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800">
                <Shield className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-white">{isEn ? "Permissions" : "Quyền bổ sung"}</h4>
            </div>
            {userPermissions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.noPermissions}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {userPermissions.map((code) => (
                  <span
                    key={code}
                    className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300"
                  >
                    {getPermissionLabel(code, undefined, isEn ? "en" : "vi")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {user.createdAt && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  <Calendar className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <h4 className="font-semibold text-zinc-900 dark:text-white">{isEn ? "System Information" : "Thông tin hệ thống"}</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800">
                    <Calendar className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{isEn ? "Created Date" : "Ngày tạo"}</p>
                    <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">
                      {new Date(user.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600">
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit User Modal Component
function EditUserModal({ 
  user, 
  onClose, 
  onSave, 
  loading 
}: { 
  user: UserResponse; 
  onClose: () => void; 
  onSave: (body: UpdateUserRequest) => void; 
  loading: boolean; 
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [departmentId, setDepartmentId] = useState<number | "">(user.departmentId ?? "");
  const [roleId, setRoleId] = useState<number | "">(user.roleId ?? "");
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  useEffect(() => {
    setFullName(user.fullName ?? "");
    setDepartmentId(user.departmentId ?? "");
    setRoleId(user.roleId ?? "");
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setMetaLoading(true);
      try {
        const [depts, rolesData] = await Promise.all([
          getTenantDepartments().catch(() => []),
          getTenantRoles().catch(() => []),
        ]);
        if (cancelled) return;
        setDepartments(depts);

        const tenantId = getStoredUser()?.tenantId ?? null;
        const cached = readTenantRolesCache(tenantId);
        const merged = mergeRolesWithCache(rolesData, cached, "all");
        const assignable = merged.filter(
          (r) => !ROLE_CODES_EXCLUDED_FROM_USER_ASSIGNMENT.has((r.code ?? "").toUpperCase())
        );
        assignable.sort((a, b) =>
          (a.name ?? a.code ?? "").localeCompare(b.name ?? b.code ?? "", undefined, { sensitivity: "base" })
        );
        setRoles(assignable);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    };
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const handleSubmit = () => {
    const body: UpdateUserRequest = {
      fullName: fullName || undefined,
      departmentId: departmentId === "" ? undefined : departmentId,
      roleId: roleId === "" ? undefined : roleId,
    };
    onSave(body);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.updateUserInfo}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.fullName}</label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.department}</label>
            <select 
              value={departmentId} 
              onChange={(e) => setDepartmentId(e.target.value === "" ? "" : Number(e.target.value))} 
              disabled={metaLoading}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name ?? `Department #${d.id}`}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.role}</label>
            <select 
              value={roleId} 
              onChange={(e) => setRoleId(e.target.value === "" ? "" : Number(e.target.value))} 
              disabled={metaLoading}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name ?? r.code ?? `Role #${r.id}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || metaLoading}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEn ? "Saving..." : "Đang lưu..."}
              </span>
            ) : (
              t.save
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// Update Permissions Modal Component
function UpdatePermissionsModal({
  user,
  permissions,
  selected,
  setSelected,
  rolePermissions,
  loading,
  onClose,
  onSave,
}: {
  user: UserResponse;
  permissions: { code: string; name?: string }[];
  selected: string[];
  setSelected: (next: string[]) => void;
  rolePermissions: string[];
  loading: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";

  const role = user.roleName;

  const togglePermission = (code: string) => {
    // Don't allow toggling role permissions
    if (rolePermissions.includes(code)) return;
    setSelected(selected.includes(code) ? selected.filter((p) => p !== code) : [...selected, code]);
  };

  const isRolePermission = (code: string) => rolePermissions.includes(code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.updateUserPermissions}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {user.fullName ?? user.email ?? "User"}
              {role && (
                <span className="ml-2 inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {role}
                </span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {rolePermissions.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {isEn ? "Permissions from role (read-only)" : "Quyền từ vai trò (chỉ đọc)"}
            </p>
            <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              {rolePermissions.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300"
                >
                  <Check className="h-3 w-3" />
                  {getPermissionLabel(code, undefined, isEn ? "en" : "vi")}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {isEn ? "Additional permissions (editable)" : "Quyền bổ sung (có thể chỉnh sửa)"}
          </p>
          <div className="max-h-[40vh] overflow-y-auto rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            {permissions.length === 0 ? (
              <p className="text-sm text-zinc-500">{t.noPermissions}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {permissions.map((p) => {
                  const active = selected.includes(p.code);
                  const isRole = isRolePermission(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => togglePermission(p.code)}
                      disabled={isRole}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        isRole
                          ? "cursor-default border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300"
                          : active
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isRole
                            ? "border-cyan-400 bg-cyan-400"
                            : active
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                        }`}>
                          {active && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            {getPermissionLabel(p.code, p.name, isEn ? "en" : "vi")}
                          </div>
                          <div className="mt-0.5 text-[11px] uppercase tracking-wide opacity-70">{p.code}</div>
                        </div>
                        {isRole && (
                          <span className="shrink-0 rounded bg-cyan-200 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300">
                            {isEn ? "Role" : "Vai trò"}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {isEn ? "Selected" : "Đã chọn"}: {selected.length}
            {rolePermissions.length > 0 && (
              <span className="ml-1">
                ({rolePermissions.length} {isEn ? "from role" : "từ vai trò"})
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEn ? "Saving..." : "Đang lưu..."}
                </>
              ) : (
                t.save
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
