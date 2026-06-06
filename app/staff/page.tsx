"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Database,
  FileText,
  Loader2,
  MessageSquare,
  PieChart,
} from "lucide-react";
import {
  fetchPlatformDashboard,
  parsePlatformDashboardJson,
  type ParsedPlatformDashboard,
} from "@/lib/api/platform-dashboard";
import { getStaffSubscriptions, type StaffSubscription } from "@/lib/api/staff";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import {
  formatCheckedAt,
  formatCompactInt,
  formatUptimeSeconds,
} from "@/components/super-admin/dashboard-chart-utils";
import { ErrorNotice } from "@/components/ui";
import { dashboardPanelClass } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils/cn";

export default function StaffDashboardPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [parsed, setParsed] = useState<ParsedPlatformDashboard | null>(null);
  const [subs, setSubs] = useState<StaffSubscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    setStatsLoading(true);
    setError(null);
    void fetchPlatformDashboard(true)
      .then(({ ok, status, data }) => {
        if (!ok) {
          if (status === 401) throw new Error(language === "en" ? "Session expired. Please login again." : "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
          if (status === 403) throw new Error(language === "en" ? "You do not have permission to view this dashboard." : "Bạn không có quyền xem dashboard này.");
          if (status >= 500) throw new Error(language === "en" ? "Server error. Please retry." : "Lỗi máy chủ. Vui lòng thử lại.");
          throw new Error(t.errorLoadingData);
        }
        setParsed(parsePlatformDashboardJson(true, data));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : t.error);
        setParsed(null);
      })
      .finally(() => setStatsLoading(false));
  }, [language, t.error, t.errorLoadingData]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        loadDashboard();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setSubsLoading(true);
      setSubsError(null);
      void getStaffSubscriptions()
        .then((data) => {
          if (!cancelled) {
            setSubs(data);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setSubsError(e instanceof Error ? e.message : language === "en" ? "Failed to load subscriptions" : "Không tải được subscriptions");
            setSubs([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSubsLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const llmRows = parsed
    ? [
        { key: "tr", label: language === "en" ? "Total requests" : "Tổng request", value: parsed.llmUsage.totalRequests },
        { key: "rm", label: language === "en" ? "Requests (this month)" : "Request tháng này", value: parsed.llmUsage.requestsThisMonth },
        { key: "tt", label: language === "en" ? "Total tokens" : "Tổng token", value: parsed.llmUsage.totalTokensUsed },
        { key: "tm", label: language === "en" ? "Tokens (this month)" : "Token tháng này", value: parsed.llmUsage.tokensThisMonth },
      ]
    : [];
  const llmMax = Math.max(...llmRows.map((r) => r.value), 1);

  const docsBars = parsed
    ? [
        {
          key: "doc",
          label: language === "en" ? "Documents" : "Tài liệu",
          value: parsed.documents.totalDocuments,
          icon: FileText,
          hint: language === "en" ? "Files" : "Tệp",
        },
        {
          key: "chunk",
          label: language === "en" ? "Chunks" : "Chunk",
          value: parsed.documents.totalChunks,
          icon: Database,
          hint: language === "en" ? "Indexed chunks" : "Chunk đã lập chỉ mục",
        },
      ]
    : [];
  const docsMax = Math.max(...docsBars.map((b) => b.value), 1);
  const tenantRows = parsed
    ? [
        { key: "active", name: language === "en" ? "Active" : "Hoạt động", count: parsed.tenants.active, color: "bg-emerald-500" },
        { key: "pending", name: language === "en" ? "Pending" : "Chờ duyệt", count: parsed.tenants.pending, color: "bg-amber-500" },
        { key: "suspended", name: language === "en" ? "Suspended" : "Tạm ngưng", count: parsed.tenants.suspended, color: "bg-zinc-500" },
        { key: "rejected", name: language === "en" ? "Rejected" : "Từ chối", count: parsed.tenants.rejected, color: "bg-red-500" },
      ]
    : [];
  const tenantSum = tenantRows.reduce((s, x) => s + x.count, 0);
  const planCodeOrder = ["TRIAL", "STARTER", "STANDARD", "ENTERPRISE"] as const;
  type PlanCode = (typeof planCodeOrder)[number];
  const viPlanMap: Record<string, string> = {
    TRIAL: "Dùng thử",
    STARTER: "Khởi đầu",
    STANDARD: "Tiêu chuẩn",
    ENTERPRISE: "Doanh nghiệp",
  };
  const enPlanMap: Record<string, string> = {
    TRIAL: "Trial",
    STARTER: "Starter",
    STANDARD: "Standard",
    ENTERPRISE: "Enterprise",
  };
  const isActiveSub = (status?: string) => {
    const x = (status || "").toUpperCase();
    return x === "ACTIVE" || x === "TRIAL";
  };
  const byPlan = new Map<string, number>();
  const isPlanCode = (value: string): value is PlanCode =>
    (planCodeOrder as readonly string[]).includes(value);
  planCodeOrder.forEach((code) => byPlan.set(code, 0));
  subs.forEach((s) => {
    const code = (s.tier || "").toUpperCase();
    if (!isPlanCode(code)) return;
    if (isActiveSub(s.status)) byPlan.set(code, (byPlan.get(code) || 0) + 1);
  });
  const subChartRows = planCodeOrder.map((code) => ({
    code,
    label: language === "en" ? enPlanMap[code] : viPlanMap[code],
    active: byPlan.get(code) || 0,
  }));
  const maxSubActive = Math.max(...subChartRows.map((x) => x.active), 1);
  const totalActiveSubs = subChartRows.reduce((s, x) => s + x.active, 0);
  const systemLabel =
    parsed?.systemStatus === "Healthy"
      ? t.healthy
      : parsed?.systemStatus === "Unhealthy"
        ? t.unhealthy
        : (parsed?.system.statusLabel || parsed?.systemStatusLabelRaw || "").trim() || t.unknown;

  return (
      <div className="dashboard-page-shell space-y-10">
        <div className="pt-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            {t.staffDashboard}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {t.staffDescription}
          </p>
        </div>

        {statsLoading ? (
          <div className={cn("flex items-center justify-center gap-2", dashboardPanelClass)}>
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="text-sm text-zinc-500">{t.loading}…</span>
          </div>
        ) : !parsed ? (
          <ErrorNotice message={error || t.noData} />
        ) : (
          <>
            <div className="mt-2 grid gap-6 lg:grid-cols-2 lg:mt-6 lg:gap-8">
              <div className={dashboardPanelClass}>
                <div className="mb-8">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                      <PieChart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{language === "en" ? "Tenant overview" : "Tổ chức — tổng quan"}</h3>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-400">
                    {language === "en" ? "Counts and share by lifecycle status" : "Số lượng và tỷ lệ theo trạng thái vòng đời"}
                  </p>
                </div>
                <div className="space-y-5">
                  {tenantRows.map((row) => {
                    const pct = tenantSum > 0 ? Math.round((row.count / tenantSum) * 1000) / 10 : 0;
                    return (
                      <div key={row.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${row.color}`} />
                            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{row.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-zinc-900 dark:text-white">{row.count.toLocaleString()}</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">({pct}%)</span>
                          </div>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 rounded-2xl bg-zinc-100/95 p-4 text-center ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{language === "en" ? "Approved total" : "Tổng đã duyệt"}</p>
                    <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{parsed.tenants.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className={dashboardPanelClass}>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                        <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                        {language === "en" ? "Subscriptions by plan" : "Đăng ký theo gói"}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-400">
                      {language === "en" ? "Tenant subscriptions grouped by subscription plan" : "Số subscription của tenant theo từng gói"}
                    </p>
                  </div>
                  <Link href="/staff/subscriptions" className="text-sm font-medium text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400">
                    {language === "en" ? "Open full list →" : "Xem danh sách đầy đủ →"}
                  </Link>
                </div>
                <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/50 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>{language === "en" ? "Active subscriptions" : "Subscription đang hoạt động"}</span>
                  </div>
                  {subsLoading ? (
                    <div className="py-12 text-center text-zinc-500">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 items-end gap-2 pt-4 sm:gap-4">
                      {subChartRows.map((row) => (
                        <div key={row.code} className="group flex min-w-0 flex-col items-center gap-2">
                          <div className="relative flex h-44 w-full items-end justify-center">
                            <div
                              className="w-8 rounded-t-lg bg-emerald-500/80 transition-all group-hover:bg-emerald-500 sm:w-10"
                              style={{ height: `${Math.max((row.active / maxSubActive) * 120, row.active === 0 ? 6 : 16)}px` }}
                            />
                          </div>
                          <p className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-zinc-800 dark:text-zinc-200 sm:text-xs">
                            {row.label}
                          </p>
                          <p className="text-[11px] tabular-nums text-zinc-700 dark:text-zinc-300">{row.active}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {subsError ? (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{subsError}</p>
                  ) : null}
                </div>
                {!subsLoading && (
                  <div className="mt-4 rounded-2xl bg-white/90 p-4 text-center ring-1 ring-blue-200/70 dark:ring-0 dark:bg-zinc-900/50">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                      {language === "en" ? "Active total" : "Tổng active"}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                      {totalActiveSubs}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {language === "en" ? `All subscriptions: ${subs.length}` : `Tất cả subscription: ${subs.length}`}
                    </p>
                  </div>
                )}
                <div className="mt-3 rounded-2xl bg-zinc-100/95 p-4 text-center ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    {language === "en" ? "subscriptions.total (dashboard)" : "subscriptions.total (dashboard)"}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {parsed.subscriptions.total.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-6 lg:grid-cols-2 lg:mt-4">
              <div className={dashboardPanelClass}>
                <div className="mb-8 flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                        <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{language === "en" ? "LLM usage" : "Sử dụng LLM"}</h3>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-400">
                      {language === "en" ? "Requests and tokens (all-time vs this month)" : "Request và token (tổng vs tháng hiện tại)"}
                    </p>
                  </div>
                </div>
                <div className="space-y-5">
                  {llmRows.map((r) => (
                    <div key={r.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{r.label}</span>
                        <span className="text-base font-bold text-zinc-900 dark:text-white">{formatCompactInt(r.value)}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/85 ring-1 ring-emerald-100/70 dark:bg-zinc-800/60 dark:ring-0">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-600" style={{ width: `${Math.max((r.value / llmMax) * 100, r.value > 0 ? 4 : 0)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={dashboardPanelClass}>
                <div className="mb-8">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/20">
                      <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{language === "en" ? "Document Dashboard" : "Document Dashboard"}</h3>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-400">
                    {language === "en" ? "Document files and indexed chunks" : "Tệp tài liệu và chunk index"}
                  </p>
                </div>
                <div className="mb-8 flex min-h-[140px] items-end justify-between gap-4">
                  {docsBars.map((b) => {
                    const Icon = b.icon;
                    const pct = docsMax > 0 ? (b.value / docsMax) * 100 : 0;
                    return (
                      <div key={b.key} className="flex flex-1 flex-col items-center gap-3">
                        <div className="w-full">
                          <div className="flex w-full min-h-[36px] items-end justify-center rounded-t-xl bg-gradient-to-t from-cyan-400 via-teal-500 to-emerald-600" style={{ height: `${Math.max(pct * 1.2, b.value === 0 ? 6 : 36)}px` }} />
                        </div>
                        <div className="text-center">
                          <Icon className="mx-auto mb-1 h-4 w-4 text-teal-600 dark:text-teal-400" />
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{b.label}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">{b.hint}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-6 rounded-2xl bg-zinc-100/95 p-5 ring-1 ring-zinc-200/80 dark:bg-zinc-800/40 dark:ring-0">
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{language === "en" ? "Documents" : "Tài liệu"}</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{parsed.documents.totalDocuments.toLocaleString()}</p>
                  </div>
                  <div className="border-l border-zinc-200 text-center dark:border-zinc-700">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{language === "en" ? "Chunks" : "Chunk"}</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{formatCompactInt(parsed.documents.totalChunks)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-6 lg:grid-cols-2 lg:mt-4">
              <div className={dashboardPanelClass}>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{language === "en" ? "System health" : "Sức khỏe hệ thống"}</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{language === "en" ? "From analytics `system` object" : "Từ object `system` trong analytics"}</p>
                <div className="mt-6 space-y-3">
                  {[
                    { id: "platform", name: language === "en" ? "Platform (API status)" : "Nền tảng (API)", detail: systemLabel, ok: parsed.systemStatus === "Healthy" },
                    { id: "uptime", name: language === "en" ? "App uptime" : "Thời gian chạy", detail: formatUptimeSeconds(parsed.system.appUptimeSeconds), ok: true },
                    { id: "checked", name: language === "en" ? "Last checked" : "Kiểm tra lần cuối", detail: formatCheckedAt(parsed.system.checkedAt), ok: true },
                  ].map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl bg-zinc-100/95 p-4 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-0">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${s.ok ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                          {s.id === "uptime" ? <Activity className="h-4 w-4 text-green-500" /> : s.id === "checked" ? <Clock className="h-4 w-4 text-green-500" /> : s.ok ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{s.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.detail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{s.ok ? (language === "en" ? "OK" : "Ổn") : language === "en" ? "Warn" : "Cảnh báo"}</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{language === "en" ? "Status" : "Trạng thái"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
  );
}
