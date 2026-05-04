"use client";

import "@/lib/chartjs-register";
import { useMemo } from "react";
import { Chart } from "react-chartjs-2";
import { MessageSquare, TrendingUp } from "lucide-react";
import { ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";
import { ErrorNotice } from "@/components/ui";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import type { TenantLlmUsageResponse } from "@/lib/api/tenant-admin";
import { useAppTheme } from "@/lib/use-app-theme";
import type { ChartData, ChartOptions } from "chart.js";
import { barGradientBluePurple, lineFillGradientBluePurple } from "@/lib/chart-gradients";

export function AIUsageChart({
  data = null,
  loading = false,
  error = null,
}: {
  data?: TenantLlmUsageResponse | null;
  loading?: boolean;
  error?: string | null;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const { theme } = useAppTheme();
  const isDark = theme === "dark";

  const requestsToday = data?.requestsToday ?? 0;
  const requestsThisMonth = data?.requestsThisMonth ?? 0;
  const totalRequests = data?.totalRequests ?? 0;
  const tokensToday = data?.tokensToday ?? 0;
  const tokensThisMonth = data?.tokensThisMonth ?? 0;
  const totalTokensUsed = data?.totalTokensUsed ?? 0;

  const peakRequests = Math.max(requestsToday, requestsThisMonth, totalRequests);

  const chartData = useMemo(
    () => ({
      labels: [t.chartToday, t.chartThisMonth, t.chartAllTime],
      datasets: [
        {
          type: "bar" as const,
          label: t.chartLegendAiRequests,
          data: [requestsToday, requestsThisMonth, totalRequests],
          order: 2,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 56,
          borderWidth: 0,
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "#6366f1";
            return barGradientBluePurple(ctx, chartArea);
          },
          hoverBackgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "#7c3aed";
            return barGradientBluePurple(ctx, chartArea);
          },
        },
        {
          type: "line" as const,
          label: t.chartLegendTokens,
          data: [tokensToday, tokensThisMonth, totalTokensUsed],
          yAxisID: "y1",
          order: 1,
          tension: 0.35,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: isDark ? "#fafafa" : "#18181b",
          pointBorderColor: "#a855f7",
          pointBorderWidth: 2,
          borderWidth: 2,
          borderColor: "#c084fc",
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(168, 85, 247, 0.15)";
            return lineFillGradientBluePurple(ctx, chartArea);
          },
        },
      ],
    }),
    [
      isDark,
      requestsToday,
      requestsThisMonth,
      totalRequests,
      tokensToday,
      tokensThisMonth,
      totalTokensUsed,
      t.chartAllTime,
      t.chartLegendAiRequests,
      t.chartLegendTokens,
      t.chartThisMonth,
      t.chartToday,
    ],
  );

  const chartOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      animation: {
        duration: 900,
        easing: "easeOutQuart",
      },
      layout: { padding: { top: 8, right: 8, bottom: 4, left: 4 } },
      plugins: {
        legend: {
          position: "bottom",
          align: "center",
          labels: {
            color: isDark ? "#a1a1aa" : "#52525b",
            padding: 18,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 12, family: "inherit" },
          },
        },
        tooltip: {
          backgroundColor: isDark ? "#18181b" : "#fafafa",
          titleColor: isDark ? "#fafafa" : "#18181b",
          bodyColor: isDark ? "#d4d4d8" : "#3f3f46",
          borderColor: isDark ? "rgba(168, 85, 247, 0.35)" : "rgba(99, 102, 241, 0.35)",
          borderWidth: 1,
          cornerRadius: 12,
          padding: 12,
          displayColors: true,
          boxPadding: 6,
          callbacks: {
            label(ctx) {
              const v = ctx.parsed.y;
              if (v == null || Number.isNaN(v)) return `${ctx.dataset.label ?? ""}`;
              return ` ${ctx.dataset.label}: ${Number(v).toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: isDark ? "#a1a1aa" : "#71717a",
            font: { size: 11, weight: 500 },
          },
          border: { display: false },
        },
        y: {
          position: "left",
          beginAtZero: true,
          suggestedMax: undefined,
          grid: {
            color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            drawTicks: false,
          },
          ticks: {
            color: isDark ? "#71717a" : "#a1a1aa",
            maxTicksLimit: 6,
            callback(value) {
              if (typeof value === "number") return value.toLocaleString();
              return value;
            },
          },
          border: { display: false },
        },
        y1: {
          position: "right",
          beginAtZero: true,
          grid: { display: false },
          ticks: {
            color: isDark ? "#a78bfa" : "#7c3aed",
            maxTicksLimit: 6,
            callback(value) {
              if (typeof value === "number") return value.toLocaleString();
              return value;
            },
          },
          border: { display: false },
        },
      },
    }),
    [isDark],
  );

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-zinc-800/60 bg-gradient-to-br from-zinc-950 via-violet-950/15 to-zinc-900 p-8 shadow-xl shadow-black/30 dark:border-zinc-800/60">
        <ChatbotSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorNotice message={error} />;
  }

  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white via-violet-50/40 to-indigo-50/30 p-6 shadow-lg shadow-violet-200/40 sm:p-8 dark:border-zinc-800/60 dark:from-zinc-950 dark:via-violet-950/20 dark:to-zinc-900 dark:shadow-black/40">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/15 ring-1 ring-violet-500/20">
              <MessageSquare className="h-5 w-5 text-violet-600 dark:text-violet-300" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t.llmRequestVolumeTitle}</h3>
          </div>
          <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">{t.llmRequestVolumeHint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start rounded-2xl bg-gradient-to-r from-violet-600/15 to-fuchsia-600/15 px-4 py-2 ring-1 ring-violet-500/20">
          <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-300" />
          <span className="text-sm font-bold text-violet-700 dark:text-violet-200">
            {peakRequests.toLocaleString()} · {t.peak}
          </span>
        </div>
      </div>

      <div className="mb-8 h-[min(22rem,55vw)] w-full min-h-[220px] sm:h-72">
        <Chart
          type="bar"
          data={chartData as unknown as ChartData<"bar">}
          options={chartOptions}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white/70 p-5 ring-1 ring-zinc-200/80 dark:bg-zinc-900/50 dark:ring-zinc-700/60 sm:grid-cols-3 sm:gap-6">
        <div className="text-center sm:text-left">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.totalAiRequestsLabel}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{totalRequests.toLocaleString()}</p>
        </div>
        <div className="text-center sm:border-x sm:border-zinc-200 sm:px-2 sm:text-center dark:sm:border-zinc-700">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.tokensThisMonthLabel}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{tokensThisMonth.toLocaleString()}</p>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.totalTokensUsedLabel}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{totalTokensUsed.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
