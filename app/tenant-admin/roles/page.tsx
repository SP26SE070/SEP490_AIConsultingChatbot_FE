"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getPermissionLabel } from "@/lib/permission-labels";
import { AnimatedSegmentedControl, ErrorNotice, useConfirmDialog } from "@/components/ui";
import {
  createTenantRole,
  deleteTenantRole,
  getTenantAvailablePermissions,
  getTenantCustomRoles,
  getTenantFixedRoles,
  getTenantRoleById,
  getTenantRoles,
  updateTenantRole,
  type CreateRoleRequest,
  type RoleResponse,
} from "@/lib/api/tenant-admin";
import { Eye, Loader2, MoreVertical, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getAccessToken, getRefreshToken, getStoredUser, refreshAuth } from "@/lib/auth-store";
import {
  mergeRolesWithCache,
  readTenantRolesCache,
  writeTenantRolesCache,
} from "@/lib/tenant-roles-cache";

type FilterMode = "all" | "custom" | "fixed";

const TAB_EASE = [0.22, 1, 0.36, 1] as const;

const ROLE_LEVEL_OPTIONS = [
  { value: 1, label: "Level 1 (Executive)" },
  { value: 2, label: "Level 2 (Management)" },
  { value: 3, label: "Level 3 (Senior)" },
  { value: 4, label: "Level 4 (Employee)" },
  { value: 5, label: "Level 5 (Intern / External)" },
];

function isUnauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /(unauthorized|missing or invalid token|\b401\b)/i.test(message);
}

export default function TenantAdminRolesPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [filter, setFilter] = useState<FilterMode>("all");
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = useState<{ code: string; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<RoleResponse | null>(null);
  const [editRole, setEditRole] = useState<RoleResponse | null>(null);
  const [isFilterPending, startFilterTransition] = useTransition();
  const { confirm, confirmDialog } = useConfirmDialog();

  const fixedCodes = useMemo(() => new Set(["TENANT_ADMIN", "EMPLOYEE"]), []);

  const ensureAccessToken = useCallback(async (): Promise<boolean> => {
    if (getAccessToken()) return true;
    if (!getRefreshToken()) return false;
    const ok = await refreshAuth();
    return ok && !!getAccessToken();
  }, []);

  /** Lưu snapshot đầy đủ (tab “Tất cả”) để sau đăng xuất vẫn khôi phục hiển thị. */
  const persistFullCatalog = useCallback(async () => {
    const tenantId = getStoredUser()?.tenantId;
    if (!tenantId) return;
    try {
      const full = await getTenantRoles();
      const cached = readTenantRolesCache(tenantId);
      const merged = mergeRolesWithCache(full, cached, "all");
      writeTenantRolesCache(tenantId, merged);
    } catch {
      /* bỏ qua — chỉ là bản sao phụ */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tenantId = getStoredUser()?.tenantId ?? null;
    const cached = readTenantRolesCache(tenantId);

    const fetchRolesAndPermissions = async () => {
      const [list, perms] = await Promise.all([
        filter === "custom"
          ? getTenantCustomRoles()
          : filter === "fixed"
            ? getTenantFixedRoles()
            : getTenantRoles(),
        getTenantAvailablePermissions().catch(() => []),
      ]);
      return { list, perms };
    };

    try {
      await ensureAccessToken();

      let result: { list: RoleResponse[]; perms: { code: string; name?: string }[] };
      try {
        result = await fetchRolesAndPermissions();
      } catch (e) {
        if (isUnauthorizedError(e) && (await ensureAccessToken())) {
          result = await fetchRolesAndPermissions();
        } else {
          throw e;
        }
      }

      const { list, perms } = result;
      const merged = mergeRolesWithCache(list, cached, filter);
      setRoles(merged);
      if (tenantId && filter === "all") {
        writeTenantRolesCache(tenantId, merged);
      }
      setPermissions(perms);
    } catch (e) {
      if (cached?.length) {
        const fallback =
          filter === "all"
            ? cached
            : filter === "custom"
              ? cached.filter((r) => !fixedCodes.has((r.code ?? "").toUpperCase()))
              : cached.filter((r) => fixedCodes.has((r.code ?? "").toUpperCase()));
        setRoles(fallback);
        setError(
          language === "en"
            ? `Cannot reach server — showing roles saved on this device. ${e instanceof Error ? `(${e.message})` : ""}`
            : `Không kết nối được máy chủ — hiển thị vai trò đã lưu trên thiết bị. ${e instanceof Error ? `(${e.message})` : ""}`
        );
      } else {
        setError(e instanceof Error ? e.message : "Lỗi tải roles");
      }
    } finally {
      setLoading(false);
    }
  }, [filter, language, fixedCodes, ensureAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const isFixedRole = (role: RoleResponse) => fixedCodes.has((role.code ?? "").toUpperCase());

  const toggleMenu = (roleId: number, anchor: HTMLElement) => {
    if (openMenuId === roleId) {
      setOpenMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 200;
    const margin = 12;
    const left = Math.min(Math.max(rect.right - menuWidth, margin), window.innerWidth - menuWidth - margin);
    setMenuPos({ top: rect.bottom + 6, left });
    setOpenMenuId(roleId);
  };

  const onViewDetail = async (roleId: number) => {
    setOpenMenuId(null);
    setMenuPos(null);
    try {
      const data = await getTenantRoleById(roleId);
      setDetail(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Không thể xem chi tiết role");
    }
  };

  const onDeleteRole = async (role: RoleResponse) => {
    if (isFixedRole(role)) {
      alert("Role cố định không thể xóa.");
      return;
    }
    const ok = await confirm({
      title: "Xóa vai trò?",
      description: `Bạn có chắc muốn xóa role "${role.name ?? role.code ?? role.id}"?`,
      confirmText: "Xóa",
      cancelText: t.cancel,
      tone: "danger",
    });
    if (!ok) return;

    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoadingId(role.id);
    try {
      await deleteTenantRole(role.id);
      await load();
      await persistFullCatalog();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xóa role thất bại");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t.rolesAndPermissions}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {t.manageRolesDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <Shield className="h-4 w-4" />
            {language === "en" ? "Role filters" : "Bộ lọc vai trò"}
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/40"
          >
            <Plus className="h-4 w-4" />
            {t.addCustomRole}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnimatedSegmentedControl
            value={filter}
            onChange={(next) => {
              if (next === filter) return;
              startFilterTransition(() => setFilter(next));
            }}
            layoutId="roles-filter-pill"
            options={[
              { value: "all", label: t.all },
              { value: "custom", label: t.customRoles },
              { value: "fixed", label: t.fixedRoles },
            ]}
          />
          {isFilterPending ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {language === "en" ? "Switching..." : "Đang chuyển tab..."}
            </span>
          ) : null}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={filter}
            initial={{ opacity: 0, y: 16, scale: 0.996, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, scale: 0.994, filter: "blur(1px)" }}
            transition={{ duration: 0.36, ease: TAB_EASE }}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span className="text-sm text-zinc-500">{t.loading}…</span>
              </div>
            ) : error ? (
              <div className="p-5">
                <ErrorNotice message={error} />
              </div>
            ) : (
              <div className="table-scroll-container">
                <table className="min-w-176 table-auto text-left">
                  <thead className="border-b border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.roleLabel}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.codeLabel}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Level</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.usersCount}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.typeLabel}</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.thaoTac}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                    {roles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-500">
                          {t.noData}
                        </td>
                      </tr>
                    ) : (
                      roles.map((role, index) => {
                        const fixed = isFixedRole(role);
                        return (
                          <motion.tr
                            key={role.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.28,
                              delay: Math.min(index * 0.03, 0.24),
                              ease: TAB_EASE,
                            }}
                            className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <td className="px-4 py-4 align-top sm:px-6">
                              <p className="max-w-64 whitespace-normal text-sm font-semibold text-zinc-900 dark:text-white">{role.name ?? "—"}</p>
                              <p className="mt-1 max-w-72 whitespace-normal text-xs text-zinc-500 dark:text-zinc-400">
                                {role.description ?? (language === "vi" ? "Không có mô tả" : "No description")}
                              </p>
                            </td>
                            <td className="px-4 py-4 align-top text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                              <div className="max-w-48 whitespace-normal wrap-break-word">{role.code ?? "—"}</div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                              {role.level ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">{role.usersCount ?? 0}</td>
                            <td className="whitespace-nowrap px-4 py-4 align-top sm:px-6">
                              {fixed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                  <Shield className="h-3 w-3" />
                                  {t.fixed}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  {t.custom}
                                </span>
                              )}
                            </td>
                            <td className="relative whitespace-nowrap px-4 py-4 text-right align-top sm:px-6">
                              <button
                                type="button"
                                onClick={(e) => toggleMenu(role.id, e.currentTarget)}
                                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {actionLoadingId === role.id ? (
                                <span className="absolute right-10 top-1/2 -translate-y-1/2">
                                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                                </span>
                              ) : null}
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {openMenuId && menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpenMenuId(null); setMenuPos(null); }} />
          <div className="fixed z-50 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" style={{ top: menuPos.top, left: menuPos.left }}>
            <button
              type="button"
              onClick={() => void onViewDetail(openMenuId)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Eye className="h-4 w-4" /> Xem chi tiết
            </button>
            <button
              type="button"
              onClick={() => {
                const role = roles.find((r) => r.id === openMenuId);
                setOpenMenuId(null);
                setMenuPos(null);
                if (!role) return;
                if (isFixedRole(role)) {
                  alert("Role cố định không thể sửa.");
                  return;
                }
                setEditRole(role);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" /> Cập nhật role
            </button>
            <button
              type="button"
              onClick={() => {
                const role = roles.find((r) => r.id === openMenuId);
                if (role) void onDeleteRole(role);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" /> Xóa role
            </button>
          </div>
        </>
      )}

      {createOpen && (
        <CreateRoleModal
          permissions={permissions}
          onClose={() => setCreateOpen(false)}
          onSuccess={async () => {
            setCreateOpen(false);
            await load();
            await persistFullCatalog();
          }}
        />
      )}

      {editRole && (
        <EditRoleModal
          key={editRole.id}
          role={editRole}
          permissions={permissions}
          onClose={() => setEditRole(null)}
          onSuccess={async () => {
            setEditRole(null);
            await load();
            await persistFullCatalog();
          }}
        />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            {/* HEADER */}
            <div className="relative overflow-hidden bg-linear-to-br from-emerald-500 to-emerald-600 px-8 py-8 dark:from-emerald-600 dark:to-emerald-700">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {detail.name ?? "—"}
                    </h3>
                    <p className="mt-1 text-sm text-emerald-50">Role Details</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="rounded-xl bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* CONTENT - Card Based Layout */}
            <div className="space-y-6 p-8">
              {/* Stats Cards Row */}
              <div className="grid gap-4 sm:grid-cols-4">
                {/* Role Code Card */}
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-500/5 blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Code
                      </span>
                    </div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {detail.code ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Users Count Card */}
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-500/5 blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Users
                      </span>
                    </div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {detail.usersCount ?? 0}
                    </p>
                  </div>
                </div>

                {/* Level Card */}
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-indigo-500/5 blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M6 12h12M10 17h4" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Level
                      </span>
                    </div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {detail.level ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Status Card */}
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-purple-500/5 blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Status
                      </span>
                    </div>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      Active
                    </p>
                  </div>
                </div>
              </div>

              {/* Description Card */}
              {detail.description && (
                <div className="rounded-2xl border border-zinc-200 bg-linear-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Description
                    </h4>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {detail.description}
                  </p>
                </div>
              )}

              {/* Permissions Card */}
              {detail.permissions && detail.permissions.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-linear-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="mb-4 flex items-center gap-2">
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Permissions
                    </h4>
                    <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      {detail.permissions.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.permissions.map((perm: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                        title={perm}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {getPermissionLabel(perm, undefined, language === "en" ? "en" : "vi")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-end border-t border-zinc-200 bg-zinc-50 px-8 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:shadow-white/20 dark:hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </>
  );
}

function PermissionSelector({
  selected,
  allPermissions,
  onChange,
  disabled,
}: {
  selected: string[];
  allPermissions: { code: string; name?: string }[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { language } = useLanguageStore();
  const lang = language === "en" ? "en" : "vi";
  const toggle = (code: string) => {
    if (disabled) return;
    onChange(selected.includes(code) ? selected.filter((p) => p !== code) : [...selected, code]);
  };
  return (
    <div className="flex max-h-56 flex-wrap gap-2 overflow-auto rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      {allPermissions.map((p) => {
        const active = selected.includes(p.code);
        const label = getPermissionLabel(p.code, p.name, lang);
        return (
          <button
            key={p.code}
            type="button"
            disabled={disabled}
            onClick={() => toggle(p.code)}
            title={p.code}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-600/35 ring-2 ring-emerald-300/60 dark:ring-emerald-400/40"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function CreateRoleModal({
  permissions,
  onClose,
  onSuccess,
}: {
  permissions: { code: string; name?: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [form, setForm] = useState<CreateRoleRequest>({
    code: "",
    name: "",
    level: 4,
    description: "",
    permissions: [],
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      alert(language === "en" ? "Code and role name are required." : "Code và tên role là bắt buộc.");
      return;
    }
    setLoading(true);
    try {
      await createTenantRole({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        level: form.level,
        description: form.description?.trim() || undefined,
        permissions: form.permissions,
      });
      onSuccess();
    } catch (e) {
      alert(e instanceof Error ? e.message : language === "en" ? "Failed to create role." : "Tạo role thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.addCustomRole}</h3>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              {language === "en" ? "Code *" : "Mã *"}
            </label>
            <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" placeholder="HR_MANAGER" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">{t.roleLabel} *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" placeholder="HR Manager" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">Level *</label>
            <select
              value={form.level}
              onChange={(e) => setForm((p) => ({ ...p, level: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              {ROLE_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">{t.description}</label>
            <textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="mt-1 h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              {language === "en" ? "Permissions" : "Quyền"}
            </label>
            <PermissionSelector
              selected={form.permissions}
              allPermissions={permissions}
              onChange={(next) => setForm((p) => ({ ...p, permissions: next }))}
            />
          </div>
          <div className="mt-6 flex gap-2">
            <button type="submit" disabled={loading} className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50">
              {loading ? (language === "en" ? "Creating…" : "Đang tạo…") : language === "en" ? "Create role" : "Tạo role"}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              {t.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({
  role,
  permissions,
  onClose,
  onSuccess,
}: {
  role: RoleResponse;
  permissions: { code: string; name?: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [name, setName] = useState(role.name ?? "");
  const [level, setLevel] = useState<number>(role.level ?? 4);
  const [description, setDescription] = useState(role.description ?? "");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role.permissions ?? []);
  const [permsLoading, setPermsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const permissionsForUi = useMemo(() => {
    const codes = new Set(permissions.map((p) => p.code));
    const extra = selectedPermissions
      .filter((c) => !codes.has(c))
      .map((code) => ({ code }));
    return [...permissions, ...extra];
  }, [permissions, selectedPermissions]);

  useEffect(() => {
    setName(role.name ?? "");
    setLevel(role.level ?? 4);
    setDescription(role.description ?? "");
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    setPermsLoading(true);
    void getTenantRoleById(role.id)
      .then((full) => {
        if (cancelled) return;
        setSelectedPermissions(Array.isArray(full.permissions) ? full.permissions : []);
      })
      .catch(() => {
        if (!cancelled) setSelectedPermissions(role.permissions ?? []);
      })
      .finally(() => {
        if (!cancelled) setPermsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role.id, role.permissions]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPermissions.length === 0) {
      alert(
        language === "en"
          ? "Choose at least one permission (server requires a non-empty list)."
          : "Chọn ít nhất một quyền (máy chủ yêu cầu danh sách không rỗng)."
      );
      return;
    }
    setLoading(true);
    try {
      await updateTenantRole(role.id, {
        name: name.trim(),
        level,
        description: description.trim() || undefined,
        permissions: selectedPermissions,
      });
      onSuccess();
    } catch (e) {
      alert(e instanceof Error ? e.message : language === "en" ? "Failed to update role." : "Cập nhật role thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
          {language === "en" ? "Edit custom role" : "Sửa vai trò tùy chỉnh"}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          {language === "en" ? "Code" : "Mã"}: {role.code ?? "—"} (
          {language === "en" ? "cannot change" : "không đổi được"})
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500">{t.roleLabel}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">{language === "en" ? "Description" : "Mô tả"}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              {ROLE_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              {language === "en"
                ? "Permissions — currently granted are highlighted; tap to turn on or off"
                : "Quyền — quyền đang gán được tô sáng; bấm để bật/tắt"}
            </label>
            {permsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-8 text-sm text-zinc-500 dark:border-zinc-700">
                <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                {language === "en" ? "Loading current permissions…" : "Đang tải quyền hiện tại…"}
              </div>
            ) : (
              <PermissionSelector
                selected={selectedPermissions}
                allPermissions={permissionsForUi}
                onChange={setSelectedPermissions}
              />
            )}
          </div>
          <div className="mt-6 flex gap-2">
            <button type="submit" disabled={loading} className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50">
              {loading ? (language === "en" ? "Saving…" : "Đang lưu…") : t.save}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              {t.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

