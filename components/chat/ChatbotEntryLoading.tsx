"use client";

import { Bot, Sparkles } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";

/** Spinner thống nhất (violet + emerald), dùng trong nút và khối nhỏ */
export function ChatbotSpinner({
  size = "md",
  tone = "brand",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  tone?: "brand" | "inverse";
  className?: string;
}) {
  const dim =
    size === "xs"
      ? "h-3.5 w-3.5 border-[1.5px]"
      : size === "sm"
        ? "h-4 w-4 border-2"
        : size === "lg"
          ? "h-10 w-10 border-[3px]"
          : "h-7 w-7 border-2";

  const ring =
    tone === "inverse"
      ? "border-white/25 border-t-white border-r-white/70 border-b-white/30"
      : "border-violet-500/20 border-t-violet-500 border-r-emerald-500 border-b-indigo-500/40 dark:border-violet-400/15 dark:border-t-violet-400 dark:border-r-emerald-400 dark:border-b-indigo-400/35";

  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full ${dim} ${ring} ${className}`}
    />
  );
}

function BrandedBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-8%,rgba(139,92,246,0.14),transparent_55%)] dark:bg-[radial-gradient(ellipse_85%_50%_at_50%_-10%,rgba(124,58,237,0.22),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_60%,rgba(16,185,129,0.06),transparent_45%)] dark:bg-[radial-gradient(ellipse_55%_45%_at_100%_55%,rgba(16,185,129,0.1),transparent_50%)]"
        aria-hidden
      />
    </>
  );
}

function LoaderHero({ compact }: { compact?: boolean }) {
  const box = compact ? "h-16 w-16" : "h-24 w-24";
  const wrap = compact ? "h-24 w-24" : "h-36 w-36";
  const bot = compact ? "h-8 w-8" : "h-11 w-11";
  const sparkWrap = compact ? "h-6 w-6" : "h-8 w-8";
  const spark = compact ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className={`relative mb-6 flex ${wrap} items-center justify-center sm:mb-8`}>
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500/30 via-fuchsia-500/20 to-emerald-400/25 blur-2xl animate-pulse"
        aria-hidden
      />
      <div
        className={`absolute ${compact ? "inset-0.5" : "inset-1"} rounded-full border-2 border-dashed border-violet-400/45 dark:border-violet-400/35 animate-chatbot-orbit`}
        aria-hidden
      />
      <div
        className={`absolute ${compact ? "inset-2" : "inset-3"} rounded-full border border-emerald-400/25 dark:border-emerald-400/20 animate-chatbot-orbit-reverse`}
        aria-hidden
      />

      <div
        className={`relative flex ${box} items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-800 shadow-2xl shadow-violet-900/40 ring-4 ring-white/10 dark:ring-white/5`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.35rem]">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.18)_45%,transparent_65%)] animate-chatbot-shimmer" />
        </div>
        <Bot className={`relative ${bot} text-white drop-shadow-md`} strokeWidth={1.75} />
        <div
          className={`absolute -right-0.5 -top-0.5 flex ${sparkWrap} items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-600/40 ring-2 ring-white/30 dark:ring-zinc-900/80`}
        >
          <Sparkles className={`${spark} text-white`} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function TextCard({
  title,
  subtitle,
  showProgress,
  compactCard,
}: {
  title: string;
  subtitle: string;
  showProgress?: boolean;
  compactCard?: boolean;
}) {
  return (
    <div
      className={`w-full rounded-2xl border border-zinc-200/90 bg-white/80 text-center shadow-xl shadow-zinc-900/[0.04] backdrop-blur-md dark:border-zinc-700/60 dark:bg-zinc-950/70 dark:shadow-black/30 ${
        compactCard ? "max-w-full px-3 py-3" : "max-w-md px-5 py-4 sm:px-6 sm:py-5"
      }`}
    >
      <h2
        className={`font-semibold tracking-tight text-zinc-900 dark:text-white ${
          compactCard ? "text-sm" : "text-base sm:text-lg"
        }`}
      >
        {title}
      </h2>
      <p
        className={`text-zinc-600 dark:text-zinc-400 ${compactCard ? "mt-1 text-[11px] leading-snug" : "mt-1.5 text-sm"}`}
      >
        {subtitle}
      </p>
      {showProgress ? (
        <>
          <div
            className={`mx-auto mt-4 flex h-1.5 overflow-hidden rounded-full bg-zinc-200/90 dark:bg-zinc-800 ${
              compactCard ? "max-w-[85%]" : "max-w-[200px]"
            }`}
          >
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-500 via-violet-500 to-indigo-500 animate-chatbot-progress" />
          </div>
          <div className={`flex items-center justify-center gap-1.5 ${compactCard ? "mt-2.5" : "mt-3"}`}>
            <span className="h-1.5 w-1.5 animate-chatbot-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-chatbot-bounce rounded-full bg-violet-500 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-chatbot-bounce rounded-full bg-indigo-500 [animation-delay:300ms]" />
          </div>
        </>
      ) : null}
    </div>
  );
}

export type ChatbotEntryLoadingVariant =
  | "fullscreen"
  | "embedded"
  | "panel"
  | "sidebar"
  | "spot";

type ChatbotEntryLoadingProps = {
  variant?: ChatbotEntryLoadingVariant;
  title?: string;
  subtitle?: string;
  className?: string;
};

export function ChatbotEntryLoading({
  variant = "embedded",
  title,
  subtitle,
  className = "",
}: ChatbotEntryLoadingProps) {
  const { language } = useLanguageStore();
  const isEn = language === "en";

  const defaults: Record<
    ChatbotEntryLoadingVariant,
    { title: string; subtitle: string; showProgress: boolean; compact: boolean }
  > = {
    fullscreen: {
      title: isEn ? "Preparing your AI assistant" : "Đang chuẩn bị trợ lý AI",
      subtitle: isEn ? "Loading workspace…" : "Đang tải không gian làm việc…",
      showProgress: true,
      compact: false,
    },
    embedded: {
      title: isEn ? "Preparing your AI assistant" : "Đang chuẩn bị trợ lý AI",
      subtitle: isEn ? "Loading permissions and workspace…" : "Đang tải quyền và không gian làm việc…",
      showProgress: true,
      compact: false,
    },
    panel: {
      title: isEn ? "Loading documents" : "Đang tải tài liệu",
      subtitle: isEn ? "Fetching list from your organization…" : "Đang lấy danh sách từ tổ chức của bạn…",
      showProgress: true,
      compact: true,
    },
    sidebar: {
      title: isEn ? "Loading history" : "Đang tải lịch sử",
      subtitle: isEn ? "Almost there…" : "Sắp xong…",
      showProgress: true,
      compact: true,
    },
    spot: {
      title: isEn ? "Loading" : "Đang tải",
      subtitle: isEn ? "Please wait…" : "Vui lòng chờ…",
      showProgress: false,
      compact: true,
    },
  };

  const d = defaults[variant];
  const resolvedTitle = title ?? d.title;
  const resolvedSubtitle = subtitle ?? d.subtitle;
  const compactCard = variant === "sidebar";

  const outer =
    variant === "fullscreen"
      ? `relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-zinc-100 px-6 py-12 dark:bg-[#060607] ${className}`
      : variant === "sidebar"
        ? `relative flex min-h-[200px] w-full max-w-full flex-col items-center justify-center overflow-hidden px-2 py-5 ${className}`
        : variant === "spot"
          ? `relative flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/90 px-4 py-12 dark:border-zinc-700/70 dark:bg-zinc-950/50 ${className}`
          : variant === "panel"
            ? `relative flex min-h-[min(52vh,26rem)] w-full min-w-0 flex-col items-center justify-center overflow-hidden px-4 py-14 sm:py-16 ${className}`
            : `relative flex h-full min-h-[12rem] w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10 sm:min-h-[16rem] ${className}`;

  if (variant === "spot") {
    return (
      <div className={outer}>
        <BrandedBackdrop />
        <div className="relative z-10 flex flex-col items-center">
          <LoaderHero compact />
          <p className="text-sm font-medium text-violet-700 dark:text-violet-300">{resolvedTitle}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{resolvedSubtitle}</p>
          <div className="mt-4 w-full max-w-[220px] space-y-2">
            <div className="h-2 w-full animate-pulse rounded-full bg-zinc-200/90 dark:bg-zinc-800" />
            <div className="h-2 w-[88%] animate-pulse rounded-full bg-zinc-200/90 dark:bg-zinc-800" />
            <div className="h-2 w-[62%] animate-pulse rounded-full bg-zinc-200/90 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={outer}>
      <BrandedBackdrop />
      <div
        className={`relative z-10 flex w-full flex-col items-center px-1 ${variant === "sidebar" ? "max-w-full" : "max-w-md"}`}
      >
        <LoaderHero compact={d.compact} />
        <TextCard
          title={resolvedTitle}
          subtitle={resolvedSubtitle}
          showProgress={d.showProgress}
          compactCard={compactCard}
        />
      </div>
    </div>
  );
}

/** Hàng “trợ lý đang trả lời” trong khung chat */
export function ChatbotAssistantTyping() {
  const { language } = useLanguageStore();
  const isEn = language === "en";

  return (
    <div className="flex gap-4">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-800 shadow-lg shadow-violet-900/30 ring-1 ring-white/20">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.14)_45%,transparent_65%)] animate-chatbot-shimmer" />
        <Sparkles className="relative h-4 w-4 text-amber-200" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {isEn ? "AI Assistant" : "Trợ lý AI"}
        </div>
        <div className="inline-flex min-w-60 max-w-md flex-col gap-3 rounded-2xl border border-violet-200/50 bg-gradient-to-br from-zinc-50 to-white px-4 py-3.5 shadow-sm dark:border-violet-500/20 dark:from-zinc-900/90 dark:to-zinc-950">
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]" />
            {isEn ? "Generating answer…" : "Đang tạo câu trả lời…"}
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/90 dark:bg-zinc-800">
              <div className="h-full w-2/3 animate-chatbot-progress rounded-full bg-gradient-to-r from-emerald-500/80 via-violet-500/70 to-indigo-500/60" />
            </div>
            <div className="h-2.5 w-[92%] animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-2.5 w-[66%] animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
