"use client";

import { useState, useEffect } from "react";
import { MoreVertical, Eye, Pencil, UserCheck, UserX, Key, Trash2, Loader2, X, User, Mail, Building, Calendar, Info } from "lucide-react";
import {
  getTenantUsers,
  getTenantUserById,
  updateTenantUser,
  updateTenantUserPermissions,
  getTenantAvailablePermissions,
  activateTenantUser,
  deactivateTenantUser,
  resetTenantUserPassword,
  deleteTenantUser,
  getTenantDepartments,
  getTenantRoles,
  getTenantCustomRoles,
  type UserResponse,
  type UpdateUserRequest,
  type DepartmentResponse,
  type RoleResponse,
} from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getStoredUser } from "@/lib/auth-store";
import { mergeRolesWithCache, readTenantRolesCache } from "@/lib/tenant-roles-cache";
import { getPermissionLabel } from "@/lib/permission-labels";
import { AnimatedSegmentedControl, ErrorNotice, useConfirmDialog } from "@/components/ui";

/** Không gán user thường làm admin nền tảng / tenant admin / staff */
const ROLE_CODES_EXCLUDED_FROM_USER_ASSIGNMENT = new Set(["TENANT_ADMIN", "SUPER_ADMIN", "STAFF"]);

type StatusFilter = "ACTIVE" | "INACTIVE" | "ALL";

export function EmployeesTable() {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const t = translations[language];
  const genericError = isEn ? "An error occurred" : "Lỗi";
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<UserResponse | null>(null);
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [permissionUser, setPermissionUser] = useState<UserResponse | null>(null);
  const [availablePermissions, setAvailablePermissions] = useState<
    import("@/lib/permissions").PermissionOption[]
  >([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionMetaLoading, setPermissionMetaLoading] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadUsers = () => {
    setLoading(true);
    setError(null);
    getTenantUsers(statusFilter)
      .then((data) => {
        // Filter out Tenant Administrators from the list
        const filtered = data.filter((u) => {
          const roleName = (u.roleName ?? "").toLowerCase();
          return !roleName.includes("tenant admin");
        });
        setUsers(filtered);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t.errorLoadingData))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleActivate = (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    activateTenantUser(userId)
      .then(loadUsers)
      .catch((e) => alert(e instanceof Error ? e.message : genericError))
      .finally(() => setActionLoading(null));
  };

  const handleDeactivate = (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    deactivateTenantUser(userId)
      .then(loadUsers)
      .catch((e) => alert(e instanceof Error ? e.message : genericError))
      .finally(() => setActionLoading(null));
  };

  const handleResetPassword = (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    resetTenantUserPassword(userId)
      .then(() => alert(t.passwordResetSent))
      .catch((e) => alert(e instanceof Error ? e.message : genericError))
      .finally(() => setActionLoading(null));
  };

  const handleDelete = async (userId: string) => {
    const ok = await confirm({
      title: language === "en" ? "Remove employee from organization?" : "Xóa nhân viên khỏi tổ chức?",
      description: t.confirmDeleteUser,
      confirmText: language === "en" ? "Remove" : "Xóa",
      cancelText: t.cancel,
      tone: "danger",
    });
    if (!ok) return;

    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    deleteTenantUser(userId)
      .then(loadUsers)
      .catch((e) => alert(e instanceof Error ? e.message : genericError))
      .finally(() => setActionLoading(null));
  };

  const handleViewDetail = (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    getTenantUserById(userId)
      .then(setDetailUser)
      .catch((e) => alert(e instanceof Error ? e.message : genericError));
  };

  const openEdit = (user: UserResponse) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setEditUser(user);
  };

  const openPermissionEditor = async (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setPermissionMetaLoading(true);
    try {
      const [userDetail, permissions] = await Promise.all([
        getTenantUserById(userId),
        getTenantAvailablePermissions(),
      ]);
      const currentPermissions =
        ((userDetail as unknown as { permissions?: string[] }).permissions ?? []).filter(Boolean);
      setPermissionUser(userDetail);
      setAvailablePermissions(permissions);
      setSelectedPermissions(currentPermissions);
    } catch (e) {
      alert(e instanceof Error ? e.message : genericError);
    } finally {
      setPermissionMetaLoading(false);
    }
  };

  const handleSaveEdit = async (userId: string, body: UpdateUserRequest) => {
    setActionLoading(userId);
    try {
      await updateTenantUser(userId, body);
      setEditUser(null);
      loadUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : genericError);
    } finally {
      setActionLoading(null);
    }
  };

  const isActive = (u: UserResponse | null | undefined) => {
    if (typeof u?.isActive === "boolean") return u.isActive;
    return ((u?.status ?? "").toUpperCase() !== "INACTIVE");
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white p-8 shadow-lg dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">{t.loadingEmployees}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white p-8 shadow-lg dark:bg-zinc-950">
        <ErrorNotice message={error} />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <AnimatedSegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          layoutId="employees-status-pill"
          options={[
            { value: "ACTIVE", label: t.active },
            { value: "INACTIVE", label: t.inactive },
            { value: "ALL", label: t.all },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-purple-100/60 dark:bg-zinc-950 dark:shadow-black/40">
        <div className="table-scroll-container">
          <table className="min-w-208 table-auto divide-y divide-zinc-100 dark:divide-zinc-900 lg:min-w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t.name}</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t.email}</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t.department}</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t.role}</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t.status}</th>
                <th className="relative px-6 py-4"><span className="sr-only">{t.actions}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-500">
                    {t.noEmployees}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-4 align-top text-sm font-medium text-zinc-900 dark:text-white sm:px-6">
                      <div className="max-w-56 whitespace-normal wrap-break-word">{user.fullName ?? "—"}</div>
                    </td>
                    <td className="px-4 py-4 align-top sm:px-6">
                      <div className="max-w-72 whitespace-normal break-all text-xs text-zinc-600 dark:text-zinc-400">{user.email ?? "—"}</div>
                      {user.contactEmail ? (
                        <div className="mt-0.5 max-w-72 whitespace-normal break-all text-[11px] text-zinc-500 dark:text-zinc-500">
                          {t.contactEmail}: {user.contactEmail}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-zinc-900 dark:text-white sm:px-6">
                      <div className="max-w-40 whitespace-normal wrap-break-word">{user.departmentName ?? "—"}</div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-zinc-900 dark:text-white sm:px-6">
                      <div className="max-w-40 whitespace-normal wrap-break-word">{user.roleName ?? "—"}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top sm:px-6">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isActive(user) ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/20 text-red-600 dark:text-red-400"}`}>
                        {isActive(user) ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap px-4 py-4 text-right align-top sm:px-6">
                      <button
                        type="button"
                        onClick={(e) => toggleMenu(user.id, e.currentTarget)}
                        className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-500 dark:hover:bg-zinc-900"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {actionLoading === user.id && (
                        <span className="absolute right-8 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                const selected = users.find((u) => u.id === openMenuId);
                if (selected) openEdit(selected);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" /> {t.updateUserInfo}
            </button>
            <button
              type="button"
              onClick={() => void openPermissionEditor(openMenuId)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Key className="h-4 w-4" /> {t.updateUserPermissions}
            </button>
            {isActive(users.find((u) => u.id === openMenuId)) ? (
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

      {detailUser && (
        <DetailModal user={detailUser} onClose={() => setDetailUser(null)} />
      )}

      {editUser && (
        <EditUserModal
          key={editUser.id}
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={(body) => handleSaveEdit(editUser.id, body)}
          loading={actionLoading === editUser.id}
        />
      )}

      {permissionUser && (
        <UpdatePermissionsModal
          user={permissionUser}
          permissions={availablePermissions}
          selected={selectedPermissions}
          setSelected={setSelectedPermissions}
          loading={permissionMetaLoading || actionLoading === permissionUser.id}
          onClose={() => setPermissionUser(null)}
          onSave={async () => {
            setActionLoading(permissionUser.id);
            try {
              await updateTenantUserPermissions(permissionUser.id, selectedPermissions);
              setPermissionUser(null);
              loadUsers();
            } catch (e) {
              alert(e instanceof Error ? e.message : genericError);
            } finally {
              setActionLoading(null);
            }
          }}
        />
      )}

      {confirmDialog}

    </>
  );
}


function DetailModal({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const { language } = useLanguageStore();
  const t = translations[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-zinc-950">
        <div className="relative overflow-hidden rounded-t-3xl bg-linear-to-br from-purple-500 to-violet-600 px-6 py-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
                <User className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{t.userDetail}</h3>
                <p className="mt-1 text-sm text-purple-100">{language === "en" ? "Employee Information" : "Thông tin nhân viên"}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                <User className="h-4 w-4 text-zinc-400" />
              </div>
              <h4 className="font-semibold text-white">{language === "en" ? "User Information" : "Thông tin người dùng"}</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                  <User className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-400">{t.fullName}</p>
                  <p className="mt-0.5 text-sm font-medium text-white">{user.fullName ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                  <Info className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-400">{t.status}</p>
                  <p className="mt-0.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${(user.isActive || (user.status ?? "").toUpperCase() !== "INACTIVE") ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {(user.isActive || (user.status ?? "").toUpperCase() !== "INACTIVE") ? t.active : t.inactive}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                <Mail className="h-4 w-4 text-zinc-400" />
              </div>
              <h4 className="font-semibold text-white">{language === "en" ? "Contact Information" : "Thông tin liên hệ"}</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                  <Mail className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-400">{t.email}</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-white">{user.email ?? "—"}</p>
                </div>
              </div>
              {user.contactEmail && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                    <Mail className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-400">{t.contactEmail}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-white">{user.contactEmail}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                <Building className="h-4 w-4 text-zinc-400" />
              </div>
              <h4 className="font-semibold text-white">{language === "en" ? "Organization Information" : "Thông tin tổ chức"}</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                  <Building className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-400">{t.department}</p>
                  <p className="mt-0.5 text-sm font-medium text-white">{user.departmentName ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                  <User className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-400">{t.role}</p>
                  <p className="mt-0.5 text-sm font-medium text-white">{user.roleName ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {user.createdAt && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                </div>
                <h4 className="font-semibold text-white">{language === "en" ? "System Information" : "Thông tin hệ thống"}</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-400">{language === "en" ? "Created Date" : "Ngày tạo"}</p>
                    <p className="mt-0.5 text-sm font-medium text-white">
                      {new Date(user.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 px-6 py-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:bg-purple-600">
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}


function EditUserModal({ user, onClose, onSave, loading }: { user: UserResponse; onClose: () => void; onSave: (body: UpdateUserRequest) => void; loading: boolean; }) {
  const { language } = useLanguageStore();
  const t = translations[language];
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
        const [depts, rowsMain, rowsCustom] = await Promise.all([
          getTenantDepartments().catch(() => []),
          getTenantRoles().catch(() => []),
          getTenantCustomRoles().catch(() => []),
        ]);
        if (cancelled) return;
        setDepartments(depts);

        const tenantId = getStoredUser()?.tenantId ?? null;
        const cached = readTenantRolesCache(tenantId);
        const byId = new Map<number, RoleResponse>();
        for (const r of [...rowsMain, ...rowsCustom]) {
          if (r.id > 0) byId.set(r.id, r);
        }
        const combined = Array.from(byId.values());
        const merged = mergeRolesWithCache(combined, cached, "all");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.updateUserInfo}</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500">{t.fullName}</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">{t.department}</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value === "" ? "" : Number(e.target.value))} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
              <option value="">—</option>
              {departments.map((d) => (<option key={d.id} value={d.id}>{d.name ?? `Department #${d.id}`}</option>))}
            </select>
            {metaLoading && <p className="mt-1 text-xs text-zinc-500">{t.loadingDepartments}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">{t.role}</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value === "" ? "" : Number(e.target.value))} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ?? r.code ?? `Role #${r.id}`}
                </option>
              ))}
            </select>
            {metaLoading && <p className="mt-1 text-xs text-zinc-500">{language === "en" ? "Loading roles..." : "Đang tải danh sách vai trò..."}</p>}
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => onSave({ fullName, departmentId: departmentId === "" ? undefined : departmentId, roleId: roleId === "" ? undefined : roleId })} disabled={loading} className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : t.save}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

function UpdatePermissionsModal({
  user,
  permissions,
  selected,
  setSelected,
  loading,
  onClose,
  onSave,
}: {
  user: UserResponse;
  permissions: { code: string; name?: string }[];
  selected: string[];
  setSelected: (next: string[]) => void;
  loading: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";

  const togglePermission = (code: string) => {
    setSelected(selected.includes(code) ? selected.filter((p) => p !== code) : [...selected, code]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.updateUserPermissions}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {(user.fullName ?? user.email ?? "User")} - {t.selectPermissions}
        </p>

        <div className="mt-4 max-h-[52vh] overflow-y-auto rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          {permissions.length === 0 ? (
            <p className="text-sm text-zinc-500">{t.noPermissions}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {permissions.map((p) => {
                const active = selected.includes(p.code);
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => togglePermission(p.code)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      active
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-medium">
                      {getPermissionLabel(p.code, p, isEn ? "en" : "vi")}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide opacity-70">{p.code}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {isEn ? "Selected" : "Đã chọn"}: {selected.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={loading}
              className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

