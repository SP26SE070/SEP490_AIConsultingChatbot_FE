"use client";

import { useState, useEffect } from "react";
import {
  getAdminSubscriptions,
  getActiveAdminSubscriptions,
  getAdminSubscriptionsByTenant,
  getAdminSubscriptionById,
  getAdminTenants,
  type AdminSubscriptionResponse,
  type AdminTenantSummary,
} from "@/lib/api/admin";
import { Loader2, Eye, Filter, ChevronDown } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { AnimatedSegmentedControl } from "@/components/ui";
import { toast } from "@/lib/notification-store";

type FilterMode = "all" | "active";

export default function SubscriptionsPage() {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [list, setList] = useState<AdminSubscriptionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [tenantIdFilter, setTenantIdFilter] = useState("");
  const [tenants, setTenants] = useState<AdminTenantSummary[]>([]);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSubscriptionResponse | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    if (tenantIdFilter.trim()) {
      getAdminSubscriptionsByTenant(tenantIdFilter.trim())
        .then(setList)
        .catch((e) => setError(e instanceof Error ? e.message : isEn ? "Error" : "Lỗi"))
        .finally(() => setLoading(false));
    } else if (filter === "active") {
      getActiveAdminSubscriptions()
        .then(setList)
        .catch((e) => setError(e instanceof Error ? e.message : isEn ? "Error" : "Lỗi"))
        .finally(() => setLoading(false));
    } else {
      getAdminSubscriptions()
        .then(setList)
        .catch((e) => setError(e instanceof Error ? e.message : isEn ? "Error" : "Lỗi"))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    load();
  }, [filter, tenantIdFilter]);

  useEffect(() => {
    getAdminTenants()
      .then(setTenants)
      .catch((e) => setTenantsError(e instanceof Error ? e.message : isEn ? "Cannot load tenant list" : "Không tải được danh sách tổ chức"));
  }, []);

  const handleViewDetail = (id: string) => {
    getAdminSubscriptionById(id)
      .then(setDetail)
      .catch((e) => toast.error(e instanceof Error ? e.message : isEn ? "Error" : "Lỗi"));
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {isEn ? "Subscriptions - Purchased by Tenants" : "Gói đăng ký — tổ chức đã mua"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {isEn
              ? "View all subscriptions, filter by active status or tenant"
              : "Xem mọi gói đăng ký, lọc theo đang hoạt động hoặc theo tổ chức"}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          {/* Toolbar: cùng padding ngang với bảng (px-6) — tenant căn phải thẳng hàng cột Thao tác */}
          <div className="border-b border-zinc-200/80 bg-zinc-50/90 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Filter className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{isEn ? "Filter" : "Lọc"}</span>
                </div>
                <AnimatedSegmentedControl
                  value={filter}
                  onChange={setFilter}
                  layoutId="super-admin-subscriptions-filter-pill"
                  size="sm"
                  className="rounded-full bg-zinc-100/80 p-1 dark:bg-zinc-800/80"
                  options={[
                    { value: "all", label: isEn ? "All" : "Tất cả", disabled: !!tenantIdFilter.trim() },
                    { value: "active", label: isEn ? "Active" : "Đang hoạt động", disabled: !!tenantIdFilter.trim() },
                  ]}
                />
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
                <label
                  htmlFor="sub-tenant-filter"
                  className="shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {isEn ? "Tenant" : "Tổ chức"}
                </label>
                <div className="relative min-w-48 max-w-full flex-1 sm:max-w-[20rem] sm:flex-initial">
                  <select
                    id="sub-tenant-filter"
                    value={tenantIdFilter}
                    onChange={(e) => setTenantIdFilter(e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-3.5 pr-10 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-300 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:focus:border-green-500"
                  >
                    <option value="">{isEn ? "All tenants" : "Tất cả tổ chức"}</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.status ? ` (${t.status})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
            {tenantsError ? (
              <p className="mt-3 text-right text-xs text-amber-600 dark:text-amber-400">{tenantsError}</p>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{isEn ? "Loading..." : "Đang tải…"}</span>
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Tenant / Plan" : "Tổ chức / Gói"}</th>
                    <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Tier" : "Hạng gói"}</th>
                    <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Status" : "Trạng thái"}</th>
                    <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Price / Cycle" : "Giá / Chu kỳ"}</th>
                    <th className="px-6 py-3 font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Start / End" : "Bắt đầu / Hết hạn"}</th>
                    <th className="px-6 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">{isEn ? "Actions" : "Thao tác"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                        {isEn ? "No subscriptions found for the selected filters." : "Chưa có gói đăng ký hoặc không tìm thấy theo bộ lọc."}
                      </td>
                    </tr>
                  ) : (
                    list.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">{s.tenantName ?? s.tenantId}</p>
                            <p className="text-xs font-mono text-zinc-500">{s.tenantId}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">{s.tier ?? "—"}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.status === "ACTIVE" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"}`}>
                            {s.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {s.price != null ? `${Number(s.price).toLocaleString("vi-VN")} ${s.currency ?? ""}` : "—"} / {s.billingCycle ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                          {s.startDate ? new Date(s.startDate).toLocaleDateString("vi-VN") : "—"} → {s.endDate ? new Date(s.endDate).toLocaleDateString("vi-VN") : "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewDetail(s.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            <Eye className="h-3.5 w-3.5" /> {isEn ? "Details" : "Chi tiết"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            {/* HEADER */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 px-8 py-8 dark:from-blue-600 dark:to-blue-700">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {detail.tenantName ?? "Subscription"}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-sm text-blue-50">Subscription Details</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${
                        detail.status === 'ACTIVE' ? 'bg-green-500/30 text-white' : 'bg-white/20 text-white'
                      }`}>
                        {detail.status ?? "—"}
                      </span>
                    </div>
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

            {/* CONTENT */}
            <div className="space-y-6 p-8">
              {/* Stats Cards Row */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Tier Card */}
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-blue-500/5 blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Tier
                      </span>
                    </div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {detail.tier ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Price Card */}
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-500/5 blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Price
                      </span>
                    </div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {detail.price != null ? `${Number(detail.price).toLocaleString("vi-VN")} ${detail.currency ?? ""}` : "—"}
                    </p>
                  </div>
                </div>

                {/* Billing Cycle Card */}
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-purple-500/5 blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Cycle
                      </span>
                    </div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {detail.billingCycle ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Dates Card */}
                <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Duration
                    </h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">Start:</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {detail.startDate ? new Date(detail.startDate).toLocaleDateString("vi-VN") : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">End:</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {detail.endDate ? new Date(detail.endDate).toLocaleDateString("vi-VN") : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settings Card */}
                <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Settings
                    </h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">Auto Renew:</span>
                      <span className={`font-semibold ${detail.autoRenew ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'}`}>
                        {detail.autoRenew ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">Trial:</span>
                      <span className={`font-semibold ${detail.isTrial ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                        {detail.isTrial ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ID Card */}
              <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                <div className="mb-3 flex items-center gap-2">
                  <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Subscription ID
                  </h4>
                </div>
                <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                  {detail.id}
                </p>
              </div>
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
    </>
  );
}
