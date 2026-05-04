"use client";

import { Zap, Calendar, Layers, BarChart3 } from "lucide-react";
import { ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";
import { ErrorNotice } from "@/components/ui";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import type { TenantLlmUsageResponse } from "@/lib/api/tenant-admin";

function formatInt(n: number): string {
  return Number.isFinite(n) ? Math.trunc(n).toLocaleString() : "0";
}

export function AIMetrics({
  data,
  loading,
  error,
}: {
  data: TenantLlmUsageResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[120px] items-center justify-center rounded-3xl bg-white p-5 shadow-lg shadow-green-100/60 dark:bg-zinc-950 dark:shadow-black/40"
          >
            <ChatbotSpinner size="lg" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorNotice message={error} />
    );
  }

  const reqMonth = data?.requestsThisMonth ?? 0;
  const tokMonth = data?.tokensThisMonth ?? 0;
  const avgTok = data?.averageTokensPerRequest ?? 0;
  const reqToday = data?.requestsToday ?? 0;

  const metrics = [
    {
      name: t.requestsThisMonthLabel,
      value: formatInt(reqMonth),
      subtitle: t.thisMonth,
      icon: Zap,
      color: "blue" as const,
    },
    {
      name: t.tokensThisMonthLabel,
      value: formatInt(tokMonth),
      subtitle: t.thisMonth,
      icon: Layers,
      color: "purple" as const,
    },
    {
      name: t.avgTokensPerRequestLabel,
      value: formatInt(avgTok),
      subtitle: t.perAssistantReply,
      icon: BarChart3,
      color: "amber" as const,
    },
    {
      name: t.requestsTodayLabel,
      value: formatInt(reqToday),
      subtitle: t.today,
      icon: Calendar,
      color: "green" as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.name}
            className="rounded-3xl bg-white p-5 shadow-lg shadow-green-100/60 dark:bg-zinc-950 dark:shadow-black/40"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-zinc-400">{metric.name}</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {metric.value}
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{metric.subtitle}</p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  metric.color === "blue"
                    ? "bg-blue-500/10"
                    : metric.color === "green"
                      ? "bg-green-500/10"
                      : metric.color === "purple"
                        ? "bg-purple-500/10"
                        : "bg-amber-500/10"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    metric.color === "blue"
                      ? "text-blue-500"
                      : metric.color === "green"
                        ? "text-green-500"
                        : metric.color === "purple"
                          ? "text-purple-500"
                          : "text-amber-500"
                  }`}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
