"use client";

import { useState } from "react";
import { CreditCard, Calendar, TrendingUp, Loader2 } from "lucide-react";
import type { MySubscriptionResponse } from "@/lib/api/subscription";
import { cancelSubscription, toggleAutoRenew } from "@/lib/api/subscription";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { toast } from "@/lib/notification-store";

interface SubscriptionInfoProps {
  subscription: MySubscriptionResponse | null;
  loading?: boolean;
  onUpdated?: () => void;
}

const tierNameVi: Record<string, string> = {
  STARTER: "Khởi đầu",
  STANDARD: "Tiêu chuẩn",
  ENTERPRISE: "Doanh nghiệp",
  TRIAL: "Dùng thử",
};
const tierNameEn: Record<string, string> = {
  STARTER: "Starter",
  STANDARD: "Standard",
  ENTERPRISE: "Enterprise",
  TRIAL: "Trial",
};

export function SubscriptionInfo({
  subscription,
  loading,
  onUpdated,
}: SubscriptionInfoProps) {
  const [cancelLoading, setCancelLoading] = useState(false);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const { language } = useLanguageStore();
  const t = translations[language];

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await cancelSubscription(cancelReason.trim());
      setShowCancelForm(false);
      setCancelReason("");
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hủy gói thất bại");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!subscription) return;
    const next = !subscription.autoRenew;
    setAutoRenewLoading(true);
    try {
      await toggleAutoRenew(next);
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật thất bại");
    } finally {
      setAutoRenewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-8 shadow-lg dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
        <span className="text-sm text-zinc-500">{t.loading}…</span>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="rounded-3xl bg-linear-to-br from-green-50 to-emerald-50 p-8 shadow-lg dark:from-zinc-950 dark:to-zinc-900 dark:shadow-black/40">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/20">
            <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t.currentPlan}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.noPlanYet}</p>
          </div>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.selectPlanInTab}</p>
      </div>
    );
  }

  const tierMap = language === "vi" ? tierNameVi : tierNameEn;
  const tier = tierMap[subscription.tier] ?? subscription.tier;
  const nextDate = subscription.nextBillingDate || subscription.endDate;
  const isCancelled = !!subscription.cancelledAt;
  const billingCycleLabel =
    language === "vi"
      ? subscription.billingCycle === "YEARLY"
        ? "năm"
        : subscription.billingCycle === "QUARTERLY"
          ? "quý"
          : "tháng"
      : subscription.billingCycle === "YEARLY"
        ? "year"
        : subscription.billingCycle === "QUARTERLY"
          ? "quarter"
          : "month";
  const statusLabel =
    subscription.status === "ACTIVE"
      ? isCancelled
        ? language === "vi"
          ? "Đã hủy cuối kỳ"
          : "Cancelled at period end"
        : t.active
      : subscription.status;

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-linear-to-br from-white via-emerald-50/80 to-green-100/70 p-6 shadow-[0_16px_40px_rgba(16,24,40,0.08)] dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20 dark:shadow-black/30">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 ring-1 ring-emerald-500/20">
          <CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t.currentPlan}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.currentPlanDescription}</p>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
              {language === "en" ? "Current subscription" : "Gói dịch vụ hiện tại"}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-4xl font-bold text-zinc-900 dark:text-white">{tier}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  subscription.status === "ACTIVE" && !isCancelled
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {statusLabel}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">
              {subscription.price != null
                ? `${subscription.price.toLocaleString("vi-VN")}${subscription.currency === "VND" ? "đ" : subscription.currency || ""}`
                : "—"}
              <span className="ml-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">/{billingCycleLabel}</span>
            </p>
          </div>

          <span
            className="inline-flex w-fit rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            {subscription.isTrial
              ? language === "en"
                ? "Trial plan"
                : "Gói dùng thử"
              : language === "en"
                ? "Paid subscription"
                : "Gói trả phí"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {nextDate && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white/75 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="mb-1 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-4 w-4" />
              {t.renewalDate}
            </span>
            <span className="block font-semibold text-zinc-900 dark:text-white">
              {new Date(nextDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
            </span>
          </div>
        )}
        {!subscription.isTrial && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white/75 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="mb-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <TrendingUp className="h-4 w-4" />
              {t.autoRenew}
            </span>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-zinc-900 dark:text-white">
                {subscription.autoRenew ? t.on : t.off}
              </span>
              <button
                type="button"
                disabled={autoRenewLoading || isCancelled}
                onClick={handleToggleAutoRenew}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {autoRenewLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : subscription.autoRenew ? t.off : t.on}
              </button>
            </div>
          </div>
        )}
      </div>

      {!subscription.isTrial && subscription.status === "ACTIVE" && !isCancelled && (
        <div className="mt-6">
          {!showCancelForm ? (
            <button
              type="button"
              onClick={() => setShowCancelForm(true)}
              className="rounded-2xl border border-red-200 bg-white/80 px-4 py-3 font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {t.cancelPlan}
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white/85 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.cancelReason}
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t.enterReason}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={cancelLoading}
                  onClick={handleCancel}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : t.confirmCancel}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCancelForm(false); setCancelReason(""); }}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
