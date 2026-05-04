"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Eye,
  Filter,
  PauseCircle,
  RotateCcw,
  Trash2,
  X,
  XCircle,
  Building2,
  Mail,
  Send,
  Users,
  MapPin,
  Globe,
  User,
  Briefcase,
  Phone,
  Info,
  CreditCard,
  Calendar,
} from "lucide-react";
import {
  getTenants,
  getTenantById,
  approveTenant,
  resendTenantCredentials,
  suspendTenant,
  activateTenant,
  rejectTenant,
  deleteTenant,
  hardDeleteTenant,
  type Tenant,
  type TenantStatus,
} from "@/lib/api/staff";
import { toUiErrorMessage } from "@/lib/api/parseApiError";
import { ErrorNotice } from "@/components/ui";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { requestStaffPortalStatsRefresh } from "@/lib/staff-portal-stats-refresh";
import { getAccessToken, getRefreshToken, refreshAuth } from "@/lib/auth-store";
import { AnimatedSegmentedControl } from "@/components/ui";

const statusLabel: Record<TenantStatus, Record<'vi' | 'en', string>> = {
  PENDING: { vi: "Chờ duyệt", en: "Pending" },
  ACTIVE: { vi: "Đang hoạt động", en: "Active" },
  REJECTED: { vi: "Từ chối", en: "Rejected" },
  SUSPENDED: { vi: "Tạm ngưng", en: "Suspended" },
};

const statusColor: Record<TenantStatus, string> = {
  PENDING: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  ACTIVE: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  REJECTED: "bg-red-500/20 text-red-700 dark:text-red-400",
  SUSPENDED: "bg-zinc-500/20 text-zinc-600 dark:text-zinc-400",
};

function isUnauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /(unauthorized|missing or invalid token|\b401\b)/i.test(message);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return toUiErrorMessage(error, fallback);
}

export default function StaffOrganizationsPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TenantStatus | "ALL">("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTenantId, setRejectTenantId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTenantId, setDeleteTenantId] = useState<string | null>(null);
  const [hardDeleteModalOpen, setHardDeleteModalOpen] = useState(false);
  const [hardDeleteTenantId, setHardDeleteTenantId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isLocalDev = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const ensureStaffAccessToken = useCallback(async (): Promise<boolean> => {
    if (getAccessToken()) return true;
    if (!getRefreshToken()) return false;
    const ok = await refreshAuth();
    return ok && !!getAccessToken();
  }, []);

  const loadTenants = useCallback(async () => {
    try {
      setTenantsLoading(true);
      setError(null);

      await ensureStaffAccessToken();

      let data: Tenant[];
      try {
        data = await getTenants();
      } catch (e) {
        if (isUnauthorizedError(e) && (await ensureStaffAccessToken())) {
          data = await getTenants();
        } else {
          throw e;
        }
      }

      setTenants(data);
    } catch (e) {
      console.error("Failed to load tenants:", e);
      setError(
        getErrorMessage(
          e,
          language === "en" ? "Failed to load tenants list" : "Không thể tải danh sách tenant"
        )
      );
    } finally {
      setTenantsLoading(false);
    }
  }, [ensureStaffAccessToken, language]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void loadTenants();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadTenants]);

  const openRejectModal = (tenantId: string) => {
    setRejectTenantId(tenantId);
    setRejectModalOpen(true);
  };

  const openDetailModal = async (tenantId: string) => {
    setDetailModalOpen(true);
    setSelectedTenant(null);
    try {
      const tenant = await getTenantById(tenantId);
      setSelectedTenant(tenant);
    } catch (e) {
      console.error("Failed to load tenant details:", e);
      setError(language === "en" ? "Failed to load tenant details" : "Không thể tải chi tiết tenant");
    }
  };

  const openDeleteModal = (tenantId: string) => {
    setDeleteTenantId(tenantId);
    setDeleteModalOpen(true);
  };

  const handleApprove = async (tenantId: string) => {
    try {
      setActionLoading(tenantId);
      setError(null);
      setSuccessMessage(null);
      await approveTenant(tenantId);
      await loadTenants();
      requestStaffPortalStatsRefresh();
      setSuccessMessage(language === "en" ? "Tenant approved and login email sent." : "Tenant đã được duyệt và đã gửi email đăng nhập.");
    } catch (e: unknown) {
      setError(getErrorMessage(e, language === "en" ? "Cannot approve tenant" : "Không thể phê duyệt tenant"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendCredentials = async (tenantId: string) => {
    try {
      setActionLoading(`resend:${tenantId}`);
      setError(null);
      setSuccessMessage(null);
      await resendTenantCredentials(tenantId);
      setSuccessMessage(
        language === "en"
          ? "Login credentials were resent successfully."
          : "Đã gửi lại thông tin đăng nhập thành công."
      );
    } catch (e: unknown) {
      setError(
        getErrorMessage(
          e,
          language === "en"
            ? "Cannot resend login credentials"
            : "Không thể gửi lại thông tin đăng nhập"
        )
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTenantId || !rejectReason.trim()) return;
    try {
      setActionLoading(rejectTenantId);
      setError(null);
      await rejectTenant(rejectTenantId, rejectReason);
      await loadTenants();
      requestStaffPortalStatsRefresh();
      setRejectModalOpen(false);
      setRejectTenantId(null);
      setRejectReason("");
    } catch (e: unknown) {
      setError(getErrorMessage(e, language === "en" ? "Cannot reject tenant" : "Không thể từ chối tenant"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (tenantId: string) => {
    try {
      setActionLoading(tenantId);
      setError(null);
      await suspendTenant(tenantId);
      await loadTenants();
      requestStaffPortalStatsRefresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, language === "en" ? "Cannot suspend tenant" : "Không thể tạm ngưng tenant"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (tenantId: string) => {
    try {
      setActionLoading(tenantId);
      setError(null);
      await activateTenant(tenantId);
      await loadTenants();
    } catch (e: unknown) {
      setError(getErrorMessage(e, language === "en" ? "Cannot reactivate tenant" : "Không thể kích hoạt lại tenant"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTenantId) return;
    try {
      setActionLoading(deleteTenantId);
      setError(null);
      await deleteTenant(deleteTenantId);
      await loadTenants();
      requestStaffPortalStatsRefresh();
      setDeleteModalOpen(false);
      setDeleteTenantId(null);
    } catch (e: unknown) {
      setError(
        getErrorMessage(
          e,
          language === "en"
            ? "Cannot mark tenant for deletion"
            : "Không thể đánh dấu xóa tenant"
        )
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteTenantId) return;
    try {
      setActionLoading(`hard:${hardDeleteTenantId}`);
      setError(null);
      await hardDeleteTenant(hardDeleteTenantId);
      await loadTenants();
      requestStaffPortalStatsRefresh();
      setHardDeleteModalOpen(false);
      setHardDeleteTenantId(null);
      setSuccessMessage(language === "en" ? "Tenant permanently deleted (dev)." : "Đã xóa cứng tenant (dev).");
    } catch (e: unknown) {
      setError(getErrorMessage(e, language === "en" ? "Cannot hard delete tenant" : "Không thể xóa cứng tenant"));
    } finally {
      setActionLoading(null);
    }
  };

  const displayedTenants =
    statusFilter === "ALL"
      ? tenants
      : tenants.filter((tenant) => tenant.status === statusFilter);

  const actionBtnClass =
    "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition disabled:opacity-50";

  const markDeleteCopy =
    language === "en"
      ? {
          action: "Mark for deletion",
          actionTitle: "Mark tenant for deletion",
          modalTitle: "Confirm mark for deletion",
          modalDescription:
            "Are you sure you want to mark this tenant for deletion? The tenant will be hidden from staff view and handled by retention workflow.",
          confirming: "Marking...",
          confirmAction: "Confirm mark",
        }
      : {
          action: "Đánh dấu xóa",
          actionTitle: "Đánh dấu xóa tổ chức",
          modalTitle: "Xác nhận đánh dấu xóa",
          modalDescription:
            "Bạn có chắc muốn đánh dấu xóa tổ chức này không? Tổ chức sẽ bị ẩn khỏi màn staff và được xử lý theo luồng lưu trữ dữ liệu.",
          confirming: "Đang đánh dấu...",
          confirmAction: "Xác nhận đánh dấu",
        };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {t.manageOrganizations}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t.organizationsDescription}
          </p>
        </div>

        {/* Tenants Table */}
        {tenantsLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-8 dark:bg-zinc-950">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="text-sm text-zinc-500">{t.loadingList}</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
            <div className="border-b border-zinc-200/80 bg-zinc-50/90 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Filter className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{language === "en" ? "Filter" : "Lọc"}</span>
                </div>
                <AnimatedSegmentedControl
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter((prev) => {
                      const next = value as TenantStatus | "ALL";
                      if (next === "ALL") return "ALL";
                      // Toggle selected status chip: click again to clear sort.
                      return prev === next ? "ALL" : next;
                    })
                  }
                  layoutId="staff-organizations-status-pill"
                  size="sm"
                  className="rounded-full bg-zinc-100/80 p-1 dark:bg-zinc-800/80"
                  options={[
                    { value: "ALL", label: t.all },
                    { value: "PENDING", label: statusLabel.PENDING[language] },
                    { value: "ACTIVE", label: statusLabel.ACTIVE[language] },
                    { value: "REJECTED", label: statusLabel.REJECTED[language] },
                    { value: "SUSPENDED", label: statusLabel.SUSPENDED[language] },
                  ]}
                />
              </div>
            </div>
            {displayedTenants.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {statusFilter === "ALL"
                  ? t.noTenants
                  : language === "en"
                    ? `No organizations with status ${statusLabel[statusFilter][language]}.`
                    : `Không có tổ chức ở trạng thái ${statusLabel[statusFilter][language]}.`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{t.nameEmail}</th>
                      <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{t.status}</th>
                      <th className="px-6 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {displayedTenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">{tenant.name}</div>
                          <div className="text-xs text-zinc-500">{tenant.contactEmail}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[tenant.status]}`}
                          >
                            {statusLabel[tenant.status][language]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openDetailModal(tenant.id)}
                              className={`${actionBtnClass} bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700`}
                              title={t.viewDetail}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>{language === "en" ? "Detail" : "Chi tiết"}</span>
                            </button>

                            {tenant.status === "PENDING" && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoading === tenant.id}
                                  onClick={() => handleApprove(tenant.id)}
                                  className={`${actionBtnClass} bg-emerald-500/90 text-white hover:bg-emerald-600`}
                                >
                                  {actionLoading === tenant.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  <span>{t.approve}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading === tenant.id}
                                  onClick={() => openRejectModal(tenant.id)}
                                  className={`${actionBtnClass} bg-red-500/90 text-white hover:bg-red-600`}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>{t.reject}</span>
                                </button>
                              </>
                            )}
                            {tenant.status === "ACTIVE" && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoading === `resend:${tenant.id}`}
                                  onClick={() => handleResendCredentials(tenant.id)}
                                  className={`${actionBtnClass} bg-sky-500/90 text-white hover:bg-sky-600`}
                                  title={language === "en" ? "Resend login credentials email" : "Gửi lại email thông tin đăng nhập"}
                                >
                                  {actionLoading === `resend:${tenant.id}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  <span>{language === "en" ? "Resend mail" : "Gửi lại mail"}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading === tenant.id}
                                  onClick={() => handleSuspend(tenant.id)}
                                  className={`${actionBtnClass} bg-amber-500/90 text-white hover:bg-amber-600`}
                                >
                                  {actionLoading === tenant.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <PauseCircle className="h-3.5 w-3.5" />
                                  )}
                                  <span>{t.suspend}</span>
                                </button>
                              </>
                            )}
                            {tenant.status === "SUSPENDED" && (
                              <button
                                type="button"
                                disabled={actionLoading === tenant.id}
                                onClick={() => handleActivate(tenant.id)}
                                className={`${actionBtnClass} bg-emerald-500/90 text-white hover:bg-emerald-600`}
                              >
                                {actionLoading === tenant.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                <span>{t.reactivate}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openDeleteModal(tenant.id)}
                              className={`${actionBtnClass} bg-red-600 text-white hover:bg-red-700`}
                              title={markDeleteCopy.actionTitle}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{markDeleteCopy.action}</span>
                            </button>
                            {isLocalDev && (
                              <button
                                type="button"
                                onClick={() => {
                                  setHardDeleteTenantId(tenant.id);
                                  setHardDeleteModalOpen(true);
                                }}
                                className={`${actionBtnClass} bg-black text-white hover:bg-zinc-800`}
                                title={language === "en" ? "Hard delete tenant (dev only)" : "Xóa cứng tenant (chỉ dev)"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{language === "en" ? "Hard delete" : "Xóa cứng"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {error && (
          <ErrorNotice message={error} />
        )}
        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            {successMessage}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t.rejectTenant}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t.rejectReason}
            </p>
            
            {error && (
              <ErrorNotice message={error} className="mt-3" />
            )}
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t.rejectReasonPlaceholder}
              rows={4}
              className="mt-4 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectTenantId(null);
                  setRejectReason("");
                  setError(null);
                }}
                disabled={actionLoading !== null}
                className="flex-1 rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading !== null || !rejectReason.trim()}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading === rejectTenantId ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.processing}
                  </span>
                ) : (
                  t.confirmReject
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
              {markDeleteCopy.modalTitle}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {markDeleteCopy.modalDescription}
            </p>
            
            {error && (
              <ErrorNotice message={error} className="mt-3" />
            )}
            
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteTenantId(null);
                  setError(null);
                }}
                disabled={actionLoading !== null}
                className="flex-1 rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading !== null}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === deleteTenantId ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {markDeleteCopy.confirming}
                  </span>
                ) : (
                  markDeleteCopy.confirmAction
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-zinc-900/60" onClick={() => {
            setDetailModalOpen(false);
            setSelectedTenant(null);
          }} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl dark:bg-zinc-950">
            {/* Header with gradient */}
            <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-purple-500 to-violet-600 px-6 py-8">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
                    <Building2 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{t.tenantDetail}</h3>
                    <p className="mt-1 text-sm text-purple-100">{language === 'vi' ? 'Thông tin chi tiết tổ chức' : 'Organization Information'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    setSelectedTenant(null);
                  }}
                  className="rounded-xl bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            {!selectedTenant ? (
              <div className="flex items-center justify-center gap-2 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-sm text-zinc-500">{t.loading}</span>
              </div>
            ) : (
              <div className="space-y-4 p-6">
                {/* Organization Info Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                      <Info className="h-4 w-4 text-zinc-400" />
                    </div>
                    <h4 className="font-semibold text-white">{language === 'vi' ? 'Thông tin tổ chức' : 'Organization Information'}</h4>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                        <Building2 className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-400">{t.organizationName}</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-white">{selectedTenant.name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                        <Info className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-400">{t.status}</p>
                        <p className="mt-0.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[selectedTenant.status]}`}>
                            {statusLabel[selectedTenant.status][language]}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                      <Mail className="h-4 w-4 text-zinc-400" />
                    </div>
                    <h4 className="font-semibold text-white">{language === 'vi' ? 'Thông tin liên hệ' : 'Contact Information'}</h4>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                        <Mail className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-400">{t.contactEmail}</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-white">{selectedTenant.contactEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                        <Users className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-400">{t.companySize}</p>
                        <p className="mt-0.5 text-sm font-medium text-white">{selectedTenant.companySize || (language === "en" ? "N/A" : "Không có")}</p>
                      </div>
                    </div>
                    {selectedTenant.address && (
                      <div className="flex items-start gap-3 sm:col-span-2">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                          <MapPin className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-400">{t.address}</p>
                          <p className="mt-0.5 text-sm font-medium text-white">{selectedTenant.address}</p>
                        </div>
                      </div>
                    )}
                    {selectedTenant.website && (
                      <div className="flex items-start gap-3 sm:col-span-2">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                          <Globe className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-400">{t.website}</p>
                          <a href={selectedTenant.website} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-sm font-medium text-purple-400 hover:text-purple-300 hover:underline">
                            {selectedTenant.website}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Representative Information Card */}
                {(selectedTenant.representativeName || selectedTenant.representativePosition || selectedTenant.representativePhone) && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                        <User className="h-4 w-4 text-zinc-400" />
                      </div>
                      <h4 className="font-semibold text-white">{t.representative}</h4>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {selectedTenant.representativeName && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                            <User className="h-4 w-4 text-zinc-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-400">{language === 'vi' ? 'Họ tên' : 'Full name'}</p>
                            <p className="mt-0.5 text-sm font-medium text-white">{selectedTenant.representativeName}</p>
                          </div>
                        </div>
                      )}
                      {selectedTenant.representativePosition && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                            <Briefcase className="h-4 w-4 text-zinc-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-400">{t.position}</p>
                            <p className="mt-0.5 text-sm font-medium text-white">{selectedTenant.representativePosition}</p>
                          </div>
                        </div>
                      )}
                      {selectedTenant.representativePhone && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                            <Phone className="h-4 w-4 text-zinc-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-400">{t.phone}</p>
                            <p className="mt-0.5 text-sm font-medium text-white">{selectedTenant.representativePhone}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* System Information Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                      <Calendar className="h-4 w-4 text-zinc-400" />
                    </div>
                    <h4 className="font-semibold text-white">{language === 'vi' ? 'Thông tin hệ thống' : 'System Information'}</h4>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedTenant.subscriptionId && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                          <CreditCard className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-400">{t.subscriptionId}</p>
                          <p className="mt-0.5 truncate font-mono text-xs text-white">{selectedTenant.subscriptionId}</p>
                        </div>
                      </div>
                    )}
                    {selectedTenant.requestedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                          <Calendar className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-400">{t.requestDate}</p>
                          <p className="mt-0.5 text-sm font-medium text-white">
                            {new Date(selectedTenant.requestedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedTenant.reviewedAt && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                          <Calendar className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-400">{t.reviewDate}</p>
                          <p className="mt-0.5 text-sm font-medium text-white">
                            {new Date(selectedTenant.reviewedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                          </p>
                        </div>
                      </div>
                    )}
                    {(selectedTenant.approvedByName || selectedTenant.rejectedByName || selectedTenant.reviewedByName) && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                          <User className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-400">
                            {selectedTenant.status === "REJECTED"
                              ? (language === "vi" ? "Người từ chối" : "Rejected by")
                              : (language === "vi" ? "Người duyệt" : "Approved by")}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-white">
                            {selectedTenant.status === "REJECTED"
                              ? (selectedTenant.rejectedByName || selectedTenant.reviewedByName || selectedTenant.reviewedBy)
                              : (selectedTenant.approvedByName || selectedTenant.reviewedByName || selectedTenant.reviewedBy)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-zinc-800 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  setSelectedTenant(null);
                }}
                className="w-full rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:bg-purple-600"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard Delete Modal (Dev only) */}
      {hardDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
              {language === "en" ? "Confirm hard delete (dev)" : "Xác nhận xóa cứng (dev)"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {language === "en"
                ? "This will permanently remove tenant and related records from the database. This action cannot be undone."
                : "Thao tác này sẽ xóa vĩnh viễn tenant và dữ liệu liên quan khỏi database. Không thể hoàn tác."}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setHardDeleteModalOpen(false);
                  setHardDeleteTenantId(null);
                }}
                className="flex-1 rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleHardDelete}
                disabled={actionLoading === `hard:${hardDeleteTenantId}`}
                className="flex-1 rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {actionLoading === `hard:${hardDeleteTenantId}` ? t.processing : (language === "en" ? "Hard delete" : "Xóa cứng")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
