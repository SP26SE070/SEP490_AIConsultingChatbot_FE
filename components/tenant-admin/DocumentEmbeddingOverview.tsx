"use client";

import { FileStack } from "lucide-react";
import { ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";
import { ErrorNotice } from "@/components/ui";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import type { TenantDocumentDashboardStatsResponse } from "@/lib/api/tenant-admin";

const STATUS_ORDER = ["COMPLETED", "PENDING", "PROCESSING", "FAILED"] as const;

function statusLabel(code: string, language: "vi" | "en"): string {
  const t = translations[language];
  switch (code) {
    case "COMPLETED":
      return t.statusCompleted;
    case "PENDING":
      return t.statusPending;
    case "PROCESSING":
      return t.statusProcessing;
    case "FAILED":
      return t.statusFailed;
    default:
      return code;
  }
}

function statusColor(code: string): string {
  switch (code) {
    case "COMPLETED":
      return "bg-emerald-500/80";
    case "PENDING":
      return "bg-amber-500/80";
    case "PROCESSING":
      return "bg-sky-500/80";
    case "FAILED":
      return "bg-red-500/80";
    default:
      return "bg-zinc-400/80";
  }
}

export function DocumentEmbeddingOverview({
  data,
  loading,
  error,
}: {
  data: TenantDocumentDashboardStatsResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-3xl bg-white p-8 shadow-lg shadow-green-100/60 dark:bg-zinc-950 dark:shadow-black/40">
        <ChatbotSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorNotice message={error} />
    );
  }

  const totalDocs = data?.totalDocuments ?? 0;
  const totalChunks = data?.totalChunks ?? 0;
  const avgChunks = data?.averageChunksPerDocument ?? 0;
  const breakdown = data?.embeddingStatusBreakdown ?? {};

  const orderedEntries = STATUS_ORDER.filter((k) => breakdown[k] != null && breakdown[k]! > 0).map((k) => ({
    code: k,
    count: breakdown[k]!,
  }));
  const maxBar = Math.max(...orderedEntries.map((e) => e.count), 1);

  return (
    <div className="rounded-3xl bg-white p-8 shadow-lg shadow-green-100/60 dark:bg-zinc-950 dark:shadow-black/40">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
          <FileStack className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t.knowledgeBaseEmbeddingTitle}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.knowledgeBaseEmbeddingHint}</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.docsLabel}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{totalDocs.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.chunksLabel}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{totalChunks.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.avgChunksPerDocLabel}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            {typeof avgChunks === "number" ? avgChunks.toFixed(1) : "0"}
          </p>
        </div>
      </div>

      {orderedEntries.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.noEmbeddingBreakdown}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.embeddingByStatusTitle}</p>
          {orderedEntries.map(({ code, count }) => (
            <div key={code}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{statusLabel(code, language)}</span>
                <span className="text-zinc-500">{count.toLocaleString()}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${statusColor(code)}`}
                  style={{ width: `${(count / maxBar) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
