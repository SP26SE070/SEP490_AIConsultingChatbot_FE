"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { AIUsageChart } from "@/components/tenant-admin/AIUsageChart";
import { AIMetrics } from "@/components/tenant-admin/AIMetrics";
import { DocumentEmbeddingOverview } from "@/components/tenant-admin/DocumentEmbeddingOverview";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import {
  getTenantLlmUsage,
  getTenantDocumentDashboardStats,
  type TenantLlmUsageResponse,
  type TenantDocumentDashboardStatsResponse,
} from "@/lib/api/tenant-admin";
import { tryRefreshAuth } from "@/lib/auth-store";
import { apiErrorLooksForbidden, parseApiErrorMessage } from "@/lib/api/parseApiError";
import { useLivePolling } from "@/lib/hooks/useLivePolling";
import { ChatbotEntryLoading, ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";

export function ChatbotAnalyticsView() {
  const { language } = useLanguageStore();
  const t = translations[language];

  const [llm, setLlm] = useState<TenantLlmUsageResponse | null>(null);
  const [docs, setDocs] = useState<TenantDocumentDashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) setSyncing(true);
    else {
      setLoading(true);
      setPageError(null);
      setForbidden(false);
    }

    await tryRefreshAuth();
    try {
      const [llmData, docData] = await Promise.all([
        getTenantLlmUsage(),
        getTenantDocumentDashboardStats(),
      ]);
      setLlm(llmData);
      setDocs(docData);
      setPageError(null);
      setForbidden(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setLlm(null);
      setDocs(null);
      setPageError(parseApiErrorMessage(raw));
      setForbidden(apiErrorLooksForbidden(raw));
    } finally {
      if (silent) setSyncing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLivePolling(
    () => load({ silent: true }),
    {
      enabled: forbidden && !!pageError,
      intervalMs: 1200,
      hiddenIntervalMs: 2500,
      runImmediately: true,
    }
  );

  return (
    <div className="scrollbar-chat-hidden h-full overflow-y-auto scroll-smooth bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t.aiAnalytics}</h1>
            <p className="mt-1 text-sm text-zinc-400">{t.aiPerformanceDescription}</p>
            <p className="mt-1 text-xs text-zinc-500">{t.analyticsDataNote}</p>
          </div>
          <Link
            href="/tenant-admin/analytics"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-white/10"
          >
            {language === "en" ? "Full dashboard" : "Bảng điều khiển đầy đủ"}
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        {pageError ? (
          <div
            className="rounded-2xl border border-red-500/35 bg-red-950/30 px-4 py-4 text-red-100/95 sm:px-5 sm:py-5"
            role="alert"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
                  <ShieldAlert className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {language === "en" ? "Could not load analytics" : "Không tải được phân tích"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed opacity-95">{pageError}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {loading ? (
                    <ChatbotSpinner size="sm" tone="inverse" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                  {t.analyticsRetryLoad}
                </button>
                {syncing ? (
                  <span className="inline-flex items-center justify-center gap-1.5 text-xs text-red-200/90">
                    <ChatbotSpinner size="xs" tone="inverse" aria-hidden />
                    {t.analyticsSyncing}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!pageError && loading ? (
          <ChatbotEntryLoading
            variant="panel"
            title={t.aiAnalytics}
            subtitle={t.loadingData}
            className="rounded-2xl border border-zinc-200/80 bg-white/50 dark:border-zinc-800/80 dark:bg-zinc-950/40"
          />
        ) : null}
        {!pageError && !loading ? (
          <>
            <AIMetrics data={llm} loading={false} error={null} />
            <AIUsageChart data={llm} loading={false} error={null} />
            <DocumentEmbeddingOverview data={docs} loading={false} error={null} />
          </>
        ) : null}
      </div>
    </div>
  );
}
