"use client";

import { useState, useEffect } from "react";
import {
  getSubscriptionPlans,
  getActiveSubscriptionPlans,
  getSubscriptionPlanTypes,
  createSubscriptionPlan,
  activateSubscriptionPlan,
  deactivateSubscriptionPlan,
  deleteSubscriptionPlan,
  updateSubscriptionPlan,
  type CreateSubscriptionPlanRequest,
  type SubscriptionPlanTypeOption,
  type SubscriptionPlanResponse,
} from "@/lib/api/admin";
import { MoreVertical, Pencil, Trash2, Loader2, Eye, Plus, Power, PowerOff } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { useConfirmDialog } from "@/components/ui";
import { toast } from "@/components/ui/AlertProvider";

type Filter = "all" | "active";

// Helper functions for number formatting (shared by all modals)
function formatNumber(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('vi-VN');
}

function parseNumber(value: string): string {
  return value.replace(/\./g, '');
}

function createPriceChangeHandler(setter: (v: string) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNumber(e.target.value);
    setter(raw);
  };
}

function getLocalizedPlanName(code?: string | null, fallback?: string | null, isEn?: boolean) {
  const normalized = (code ?? "").toUpperCase();
  const enMap: Record<string, string> = {
    TRIAL: "Trial Plan",
    STARTER: "Starter Plan",
    STANDARD: "Standard Plan",
    ENTERPRISE: "Enterprise Plan",
  };
  const viMap: Record<string, string> = {
    TRIAL: "Gói Dùng Thử",
    STARTER: "Gói Khởi Đầu",
    STANDARD: "Gói Tiêu Chuẩn",
    ENTERPRISE: "Gói Doanh Nghiệp",
  };
  const mapped = isEn ? enMap[normalized] : viMap[normalized];
  return mapped ?? fallback ?? "—";
}

export function SubscriptionPlansTable() {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [plans, setPlans] = useState<SubscriptionPlanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailPlan, setDetailPlan] = useState<SubscriptionPlanResponse | null>(null);
  const [editPlan, setEditPlan] = useState<SubscriptionPlanResponse | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const load = () => {
    setLoading(true);
    setError(null);
    (filter === "active" ? getActiveSubscriptionPlans() : getSubscriptionPlans())
      .then(setPlans)
      .catch((e) => setError(e instanceof Error ? e.message : isEn ? "Failed to load plans" : "Lỗi tải danh sách gói"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filter]);

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

  const toggleMenu = (planId: string, anchor: HTMLElement) => {
    if (openMenuId === planId) {
      setOpenMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 160; // w-40
    const margin = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, margin),
      window.innerWidth - margin - menuWidth
    );
    setMenuPos({ top: rect.bottom + 6, left });
    setOpenMenuId(planId);
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPos(null);
  };

  const runPlanAction = async (id: string, action: () => Promise<unknown>) => {
    closeMenu();
    setActionLoading(id);
    try {
      await action();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : isEn ? "Error" : "Lỗi");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (plan: SubscriptionPlanResponse) => {
    const ok = await confirm({
      title: isEn ? "Delete plan permanently?" : "Xóa vĩnh viễn gói này?",
      description: isEn
        ? "This action cannot be undone."
        : "Hành động này không thể hoàn tác.",
      confirmText: isEn ? "Delete" : "Xóa",
      cancelText: isEn ? "Cancel" : "Hủy",
      tone: "danger",
    });
    if (!ok) return;

    void runPlanAction(plan.id, () => deleteSubscriptionPlan(plan.id));
  };

  const handleDeactivate = async (plan: SubscriptionPlanResponse) => {
    const ok = await confirm({
      title: isEn ? "Deactivate this plan?" : "Ngừng kích hoạt gói này?",
      description: isEn
        ? "The plan will no longer be available for new subscriptions."
        : "Gói sẽ không còn khả dụng cho đăng ký mới.",
      confirmText: isEn ? "Deactivate" : "Ngừng kích hoạt",
      cancelText: isEn ? "Cancel" : "Hủy",
      tone: "warning",
    });
    if (!ok) return;

    void runPlanAction(plan.id, () => deactivateSubscriptionPlan(plan.id));
  };

  const handleActivate = (plan: SubscriptionPlanResponse) => {
    void runPlanAction(plan.id, () => activateSubscriptionPlan(plan.id));
  };

  const selectedMenuPlan = openMenuId ? plans.find((x) => x.id === openMenuId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Subscription Plans</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600"
          >
            <Plus className="h-4 w-4" />
            {isEn ? "Create plan" : "Tạo gói"}
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${filter === "all" ? "bg-green-500 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
          >
            {isEn ? "All" : "Tất cả"}
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${filter === "active" ? "bg-green-500 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
          >
            {isEn ? "Active" : "Đang hoạt động"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-white py-12 dark:bg-zinc-950">
          <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          <span className="text-sm text-zinc-500">{isEn ? "Loading..." : "Đang tải…"}</span>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-red-600 dark:bg-zinc-950 dark:text-red-400">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Code / Name" : "Mã / Tên"}</th>
                  <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Price (month)" : "Giá (tháng)"}</th>
                  <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Limits" : "Giới hạn"}</th>
                  <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Status" : "Trạng thái"}</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Actions" : "Thao tác"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">{isEn ? "No plans yet." : "Chưa có gói nào."}</td>
                  </tr>
                ) : (
                  plans.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">{p.code ?? p.id}</p>
                          <p className="text-xs text-zinc-500">{getLocalizedPlanName(p.code, p.name, isEn)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {p.monthlyPrice != null ? `${Number(p.monthlyPrice).toLocaleString("vi-VN")} ${p.currency ?? "VND"}` : "—"}
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                        {isEn
                          ? `Users: ${p.maxUsers ?? "—"} · Docs: ${p.maxDocuments ?? "—"}`
                          : `Người dùng: ${p.maxUsers ?? "—"} · Tài liệu: ${p.maxDocuments ?? "—"}`}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.isActive ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"}`}>
                          {p.isActive ? (isEn ? "Active" : "Đang hoạt động") : isEn ? "Inactive" : "Ngừng kích hoạt"}
                        </span>
                      </td>
                      <td className="relative px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => toggleMenu(p.id, e.currentTarget)}
                          className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {actionLoading === p.id && <Loader2 className="inline h-4 w-4 animate-spin text-green-500 ml-1" />}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={() => setDetailPlan(null)} />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            {/* HEADER */}
            <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-violet-600 px-8 py-8 dark:from-violet-600 dark:to-violet-700">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {detailPlan.name ?? detailPlan.code}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-sm text-violet-50">{isEn ? "Plan Details" : "Chi tiết gói"}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${
                        detailPlan.isActive ? 'bg-green-500/30 text-white' : 'bg-red-500/30 text-white'
                      }`}>
                        {detailPlan.isActive ? (isEn ? "Active" : "Đang hoạt động") : isEn ? "Inactive" : "Ngừng kích hoạt"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDetailPlan(null)}
                  className="rounded-xl bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="space-y-6 p-8">
              {/* Description Card */}
              {detailPlan.description && (
                <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Mô tả
                    </h4>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {detailPlan.description}
                  </p>
                </div>
              )}

              {/* Pricing Cards */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Giá tháng / quý / năm
                </h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Monthly */}
                  <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                    <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-500/5 blur-2xl" />
                    <div className="relative">
                      <div className="mb-2 flex items-center gap-2">
                        <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Tháng
                        </span>
                      </div>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">
                        {detailPlan.monthlyPrice != null ? `${Number(detailPlan.monthlyPrice).toLocaleString("vi-VN")} VND` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Quarterly */}
                  <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                    <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-500/5 blur-2xl" />
                    <div className="relative">
                      <div className="mb-2 flex items-center gap-2">
                        <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Quý
                        </span>
                      </div>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">
                        {detailPlan.quarterlyPrice != null ? `${Number(detailPlan.quarterlyPrice).toLocaleString("vi-VN")} VND` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Yearly */}
                  <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                    <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-purple-500/5 blur-2xl" />
                    <div className="relative">
                      <div className="mb-2 flex items-center gap-2">
                        <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Năm
                        </span>
                      </div>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">
                        {detailPlan.yearlyPrice != null ? `${Number(detailPlan.yearlyPrice).toLocaleString("vi-VN")} VND` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Limits Card */}
              <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                <div className="mb-4 flex items-center gap-2">
                  <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isEn ? "Max users / documents / storage (GB)" : "Người dùng / tài liệu / dung lượng (GB)"}
                  </h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{isEn ? "Users" : "Người dùng"}</span>
                    <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                      {detailPlan.maxUsers ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{isEn ? "Documents" : "Tài liệu"}</span>
                    <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                      {detailPlan.maxDocuments ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{isEn ? "Storage" : "Dung lượng"}</span>
                    <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                      {detailPlan.maxStorageGb ?? "—"} GB
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-end border-t border-zinc-200 bg-zinc-50 px-8 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={() => setDetailPlan(null)}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:shadow-white/20 dark:hover:bg-zinc-100"
              >
                {isEn ? "Close" : "Đóng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <CreatePlanModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {editPlan && <EditPlanModal plan={editPlan} onClose={() => setEditPlan(null)} onSuccess={() => { setEditPlan(null); load(); }} />}

      {openMenuId && menuPos && selectedMenuPlan && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeMenu}
          />
          <div
            className="fixed z-50 w-48 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={() => {
                const selected = plans.find((x) => x.id === openMenuId) ?? null;
                if (selected) setDetailPlan(selected);
                closeMenu();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Eye className="h-4 w-4" /> Xem chi tiết
            </button>
            <button
              type="button"
              onClick={() => {
                const selected = plans.find((x) => x.id === openMenuId) ?? null;
                if (selected) setEditPlan(selected);
                closeMenu();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" /> Cập nhật
            </button>
            {selectedMenuPlan.isActive ? (
              <button
                type="button"
                onClick={() => void handleDeactivate(selectedMenuPlan)}
                disabled={!!actionLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:text-amber-400 dark:hover:bg-amber-950/30"
              >
                <PowerOff className="h-4 w-4" /> {isEn ? "Deactivate" : "Ngừng kích hoạt"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleActivate(selectedMenuPlan)}
                disabled={!!actionLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                <Power className="h-4 w-4" /> {isEn ? "Activate" : "Kích hoạt"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDelete(selectedMenuPlan)}
              disabled={!!actionLoading}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" /> {isEn ? "Delete permanently" : "Xóa vĩnh viễn"}
            </button>
          </div>
        </>
      )}

      {confirmDialog}
    </div>
  );
}

function CreatePlanModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState<SubscriptionPlanTypeOption[]>([]);
  const [planType, setPlanType] = useState<SubscriptionPlanTypeOption["code"]>("STARTER");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("0");
  const [quarterlyPrice, setQuarterlyPrice] = useState("0");
  const [yearlyPrice, setYearlyPrice] = useState("0");
  const [maxUsers, setMaxUsers] = useState("10");
  const [maxDocuments, setMaxDocuments] = useState("100");
  const [maxStorageGb, setMaxStorageGb] = useState("5");
  const [maxApiCalls, setMaxApiCalls] = useState("10000");
  const [maxChatbotRequests, setMaxChatbotRequests] = useState("1000");
  const [maxRagDocuments, setMaxRagDocuments] = useState("500");
  const [maxAiTokens, setMaxAiTokens] = useState("100000");
  const [contextWindowTokens, setContextWindowTokens] = useState("4096");
  const [ragChunkSize, setRagChunkSize] = useState("512");
  const [aiModel, setAiModel] = useState("gpt-4");
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-ada-002");
  const [features, setFeatures] = useState("Basic features");
  const [displayOrder, setDisplayOrder] = useState("0");

  useEffect(() => {
    getSubscriptionPlanTypes()
      .then((data) => {
        setTypes(data);
        if (data.length > 0) setPlanType(data[0].code);
      })
      .catch(() => {
        const fallback: SubscriptionPlanTypeOption[] = [
          { code: "TRIAL", defaultName: "Trial" },
          { code: "STARTER", defaultName: "Starter" },
          { code: "STANDARD", defaultName: "Standard" },
          { code: "ENTERPRISE", defaultName: "Enterprise" },
        ];
        setTypes(fallback);
      });
  }, []);

  const toInt = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  };
  const toNum = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const selectedType = types.find((t) => t.code === planType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use defaultName from selected type if name is empty
      const planName = name.trim() || selectedType?.defaultName || planType;
      
      const body: CreateSubscriptionPlanRequest = {
        planType,
        name: planName,
        description: description.trim() || "Default description",
        monthlyPrice: parseFloat(monthlyPrice) || 0,
        quarterlyPrice: parseFloat(quarterlyPrice) || 0,
        yearlyPrice: parseFloat(yearlyPrice) || 0,
        maxUsers: parseInt(maxUsers) || 1,
        maxDocuments: parseInt(maxDocuments) || 0,
        maxStorageGb: parseInt(maxStorageGb) || 1,
        maxApiCalls: parseInt(maxApiCalls) || 0,
        maxChatbotRequests: parseInt(maxChatbotRequests) || 0,
        maxRagDocuments: parseInt(maxRagDocuments) || 0,
        maxAiTokens: parseInt(maxAiTokens) || 0,
        contextWindowTokens: parseInt(contextWindowTokens) || 1,
        ragChunkSize: parseInt(ragChunkSize) || 256,
        aiModel: aiModel.trim() || "string",
        embeddingModel: embeddingModel.trim() || "string",
        displayOrder: parseInt(displayOrder) || 0,
        features: features.trim() || "string",
      };
      
      console.log("📤 Request body:", JSON.stringify(body, null, 2));
      console.log("📤 All fields present:", Object.keys(body));
      await createSubscriptionPlan(body);
      onSuccess();
    } catch (err) {
      console.error("❌ Error creating plan:", err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`${isEn ? "Failed to create plan" : "Tạo gói thất bại"}\n\n${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-900/80 dark:bg-black/90" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-3xl animate-scale-in overflow-hidden rounded-3xl border border-zinc-200/50 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Gradient Header */}
        <div className="sticky top-0 z-10 overflow-hidden bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-600 px-6 py-6">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-white">
                {isEn ? "Create subscription plan" : "Tạo gói đăng ký"}
              </h3>
              <p className="mt-1 text-sm text-cyan-50">
                {isEn ? "Configure plan limits and pricing" : "Cấu hình giới hạn và giá gói"}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            {/* Plan Type Dropdown */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-800/50 dark:bg-blue-950/20">
              <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Loại gói <span className="text-red-500">*</span>
              </label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value as SubscriptionPlanTypeOption["code"])}
                required
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.defaultName}
                  </option>
                ))}
              </select>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Thông tin cơ bản
              </h4>
              
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tên gói
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Tên hiển thị của gói"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  {isEn ? "Leave empty to use default name" : "Để trống để dùng tên mặc định"}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mô tả</label>
                <input 
                  type="text" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Mô tả ngắn về gói"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>
          
          {/* Price Fields with VND */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Giá gói</label>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs text-zinc-500">Giá tháng</label>
                <div className="relative mt-1">
                  <input 
                    type="text" 
                    value={formatNumber(monthlyPrice)} 
                    onChange={createPriceChangeHandler(setMonthlyPrice)}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 pr-12 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">VND</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500">Giá quý</label>
                <div className="relative mt-1">
                  <input 
                    type="text" 
                    value={formatNumber(quarterlyPrice)} 
                    onChange={createPriceChangeHandler(setQuarterlyPrice)}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 pr-12 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">VND</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500">Giá năm</label>
                <div className="relative mt-1">
                  <input 
                    type="text" 
                    value={formatNumber(yearlyPrice)} 
                    onChange={createPriceChangeHandler(setYearlyPrice)}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 pr-12 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">VND</span>
                </div>
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-zinc-500">{isEn ? "Max users" : "Số người dùng tối đa"}</label>
              <input 
                type="number" 
                min="1" 
                value={maxUsers} 
                onChange={(e) => setMaxUsers(e.target.value)} 
                placeholder="10"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Số tài liệu</label>
              <input 
                type="number" 
                min="0" 
                value={maxDocuments} 
                onChange={(e) => setMaxDocuments(e.target.value)} 
                placeholder="100"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Dung lượng (GB)</label>
              <input 
                type="number" 
                min="1" 
                value={maxStorageGb} 
                onChange={(e) => setMaxStorageGb(e.target.value)} 
                placeholder="5"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
          </div>

          {/* Advanced Limits */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-500">Max API Calls</label>
              <input 
                type="number" 
                min="0" 
                value={maxApiCalls} 
                onChange={(e) => setMaxApiCalls(e.target.value)} 
                placeholder="10000"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Max Chatbot Requests</label>
              <input 
                type="number" 
                min="0" 
                value={maxChatbotRequests} 
                onChange={(e) => setMaxChatbotRequests(e.target.value)} 
                placeholder="1000"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Max RAG Documents</label>
              <input 
                type="number" 
                min="0" 
                value={maxRagDocuments} 
                onChange={(e) => setMaxRagDocuments(e.target.value)} 
                placeholder="500"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Max AI Tokens</label>
              <input 
                type="number" 
                min="0" 
                value={maxAiTokens} 
                onChange={(e) => setMaxAiTokens(e.target.value)} 
                placeholder="100000"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Context Window Tokens</label>
              <input 
                type="number" 
                min="1" 
                value={contextWindowTokens} 
                onChange={(e) => setContextWindowTokens(e.target.value)} 
                placeholder="4096"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">RAG Chunk Size</label>
              <input 
                type="number" 
                min="256" 
                value={ragChunkSize} 
                onChange={(e) => setRagChunkSize(e.target.value)} 
                placeholder="512"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
          </div>

          {/* AI Models */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-500">AI Model *</label>
              <input 
                type="text" 
                value={aiModel} 
                onChange={(e) => setAiModel(e.target.value)} 
                placeholder="gpt-4"
                required
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">Embedding Model *</label>
              <input 
                type="text" 
                value={embeddingModel} 
                onChange={(e) => setEmbeddingModel(e.target.value)} 
                placeholder="text-embedding-ada-002"
                required
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
          </div>

          {/* Features & Display Order */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-500">Features *</label>
              <input 
                type="text" 
                value={features} 
                onChange={(e) => setFeatures(e.target.value)} 
                placeholder="Basic features"
                required
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500">{isEn ? "Display order" : "Thứ tự hiển thị"}</label>
              <input 
                type="number" 
                min="0" 
                value={displayOrder} 
                onChange={(e) => setDisplayOrder(e.target.value)} 
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" 
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="sticky bottom-0 flex gap-3 border-t border-zinc-200 bg-white/80 pt-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-600 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEn ? "Creating..." : "Đang tạo..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  {isEn ? "Create plan" : "Tạo gói"}
                </span>
              )}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {isEn ? "Cancel" : "Hủy"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

function EditPlanModal({ plan, onClose, onSuccess }: { plan: SubscriptionPlanResponse; onClose: () => void; onSuccess: () => void }) {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(plan.name ?? "");
  const [description, setDescription] = useState(plan.description ?? "");
  const [monthlyPrice, setMonthlyPrice] = useState(String(plan.monthlyPrice ?? 0));
  const [quarterlyPrice, setQuarterlyPrice] = useState(String(plan.quarterlyPrice ?? 0));
  const [yearlyPrice, setYearlyPrice] = useState(String(plan.yearlyPrice ?? 0));
  const [maxUsers, setMaxUsers] = useState(String(plan.maxUsers ?? 10));
  const [maxDocuments, setMaxDocuments] = useState(String(plan.maxDocuments ?? 100));
  const [maxStorageGb, setMaxStorageGb] = useState(String(plan.maxStorageGb ?? 5));
  const [maxApiCalls, setMaxApiCalls] = useState(String(plan.maxApiCalls ?? 10000));
  const [maxChatbotRequests, setMaxChatbotRequests] = useState(String(plan.maxChatbotRequests ?? 1000));
  const [maxRagDocuments, setMaxRagDocuments] = useState(String(plan.maxRagDocuments ?? 500));
  const [maxAiTokens, setMaxAiTokens] = useState(String(plan.maxAiTokens ?? 100000));
  const [contextWindowTokens, setContextWindowTokens] = useState(String(plan.contextWindowTokens ?? 4096));
  const [ragChunkSize, setRagChunkSize] = useState(String(plan.ragChunkSize ?? 512));
  const [aiModel, setAiModel] = useState(plan.aiModel ?? "gpt-4");
  const [embeddingModel, setEmbeddingModel] = useState(plan.embeddingModel ?? "text-embedding-ada-002");
  const [features, setFeatures] = useState(plan.features ?? "");
  const [isActive, setIsActive] = useState(plan.isActive ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(plan.displayOrder ?? 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSubscriptionPlan(plan.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        monthlyPrice: parseFloat(monthlyPrice) || 0,
        quarterlyPrice: parseFloat(quarterlyPrice) || 0,
        yearlyPrice: parseFloat(yearlyPrice) || 0,
        maxUsers: parseInt(maxUsers) || 1,
        maxDocuments: parseInt(maxDocuments) || 0,
        maxStorageGb: parseInt(maxStorageGb) || 1,
        maxApiCalls: parseInt(maxApiCalls) || 0,
        maxChatbotRequests: parseInt(maxChatbotRequests) || 0,
        maxRagDocuments: parseInt(maxRagDocuments) || 0,
        maxAiTokens: parseInt(maxAiTokens) || 0,
        contextWindowTokens: parseInt(contextWindowTokens) || 1,
        ragChunkSize: parseInt(ragChunkSize) || 256,
        aiModel: aiModel.trim() || undefined,
        embeddingModel: embeddingModel.trim() || undefined,
        features: features.trim() || undefined,
        isActive,
        displayOrder: parseInt(displayOrder) || 0,
      });
      onSuccess();
    } catch (err) {
      console.error("❌ Error updating plan:", err);
      toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-900/80 dark:bg-black/90" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-3xl animate-scale-in overflow-hidden rounded-3xl border border-zinc-200/50 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Gradient Header */}
        <div className="sticky top-0 z-10 overflow-hidden bg-gradient-to-br from-purple-500 via-violet-500 to-purple-600 px-6 py-6">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Pencil className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-white">
                  {isEn ? `Update Plan: ${plan.code}` : `Cập nhật gói: ${plan.code}`}
                </h3>
                <p className="mt-1 text-sm text-purple-50">
                  {isEn ? "Modify plan configuration" : "Chỉnh sửa cấu hình gói"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {isEn ? "Basic Information" : "Thông tin cơ bản"}
              </h4>
              
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {isEn ? "Plan Name" : "Tên gói"} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  placeholder={isEn ? "Plan display name" : "Tên hiển thị của gói"}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {isEn ? "Description" : "Mô tả"}
                </label>
                <input 
                  type="text" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder={isEn ? "Short plan description" : "Mô tả ngắn về gói"}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>
          
            {/* Pricing Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {isEn ? "Pricing" : "Giá gói"}
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Monthly Price" : "Giá tháng"}
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formatNumber(monthlyPrice)} 
                      onChange={createPriceChangeHandler(setMonthlyPrice)}
                      placeholder="0"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 pr-12 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">VND</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Quarterly Price" : "Giá quý"}
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formatNumber(quarterlyPrice)} 
                      onChange={createPriceChangeHandler(setQuarterlyPrice)}
                      placeholder="0"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 pr-12 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">VND</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Yearly Price" : "Giá năm"}
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formatNumber(yearlyPrice)} 
                      onChange={createPriceChangeHandler(setYearlyPrice)}
                      placeholder="0"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 pr-12 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">VND</span>
                  </div>
                </div>
              </div>
            </div>
          
            {/* Resource Limits */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {isEn ? "Resource Limits" : "Giới hạn tài nguyên"}
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Max Users" : "Người dùng tối đa"}
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={maxUsers} 
                    onChange={(e) => setMaxUsers(e.target.value)} 
                    placeholder="10"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Max Documents" : "Tài liệu tối đa"}
                  </label>
                  <input 
                    type="number" 
                    min="0" 
                    value={maxDocuments} 
                    onChange={(e) => setMaxDocuments(e.target.value)} 
                    placeholder="100"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Storage (GB)" : "Dung lượng (GB)"}
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={maxStorageGb} 
                    onChange={(e) => setMaxStorageGb(e.target.value)} 
                    placeholder="5"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
              </div>
            </div>

            {/* Advanced Limits */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {isEn ? "Advanced Limits" : "Giới hạn nâng cao"}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Max API Calls</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={maxApiCalls} 
                    onChange={(e) => setMaxApiCalls(e.target.value)} 
                    placeholder="10000"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Max Chatbot Requests</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={maxChatbotRequests} 
                    onChange={(e) => setMaxChatbotRequests(e.target.value)} 
                    placeholder="1000"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Max RAG Documents</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={maxRagDocuments} 
                    onChange={(e) => setMaxRagDocuments(e.target.value)} 
                    placeholder="500"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Max AI Tokens</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={maxAiTokens} 
                    onChange={(e) => setMaxAiTokens(e.target.value)} 
                    placeholder="100000"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Context Window Tokens</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={contextWindowTokens} 
                    onChange={(e) => setContextWindowTokens(e.target.value)} 
                    placeholder="4096"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">RAG Chunk Size</label>
                  <input 
                    type="number" 
                    min="256" 
                    value={ragChunkSize} 
                    onChange={(e) => setRagChunkSize(e.target.value)} 
                    placeholder="512"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
              </div>
            </div>

            {/* AI Models */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {isEn ? "AI Configuration" : "Cấu hình AI"}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">AI Model</label>
                  <input 
                    type="text" 
                    value={aiModel} 
                    onChange={(e) => setAiModel(e.target.value)} 
                    placeholder="gpt-4" 
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Embedding Model</label>
                  <input 
                    type="text" 
                    value={embeddingModel} 
                    onChange={(e) => setEmbeddingModel(e.target.value)} 
                    placeholder="text-embedding-ada-002" 
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                  />
                </div>
              </div>
            </div>

            {/* Other Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {isEn ? "Other Settings" : "Cài đặt khác"}
              </h4>
              
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Features</label>
                <input 
                  type="text" 
                  value={features} 
                  onChange={(e) => setFeatures(e.target.value)} 
                  placeholder="Basic features" 
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {isEn ? "Display Order" : "Thứ tự hiển thị"}
                </label>
                <input 
                  type="number" 
                  min="0" 
                  value={displayOrder} 
                  onChange={(e) => setDisplayOrder(e.target.value)} 
                  placeholder="0"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                />
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                <label className="flex cursor-pointer items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={(e) => setIsActive(e.target.checked)} 
                    className="h-5 w-5 rounded border-zinc-300 text-purple-500 focus:ring-2 focus:ring-purple-500/20" 
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-white">
                      {isEn ? "Active Plan" : "Gói đang hoạt động"}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {isEn ? "Make this plan available for subscription" : "Cho phép gói này được đăng ký"}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="sticky bottom-0 flex gap-3 border-t border-zinc-200 bg-white/80 pt-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              <button 
                type="submit" 
                disabled={loading} 
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:from-purple-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEn ? "Updating..." : "Đang cập nhật..."}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Pencil className="h-4 w-4" />
                    {isEn ? "Update Plan" : "Cập nhật gói"}
                  </span>
                )}
              </button>
              <button 
                type="button" 
                onClick={onClose} 
                disabled={loading}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {isEn ? "Cancel" : "Hủy"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
