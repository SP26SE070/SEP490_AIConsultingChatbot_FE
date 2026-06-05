"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { SubscriptionTabs } from "@/components/subscription/SubscriptionTabs";
import { BillingHistory } from "@/components/tenant-admin/BillingHistory";
import {
  getAvailableSubscriptionPlans,
  getUpcomingRenewalPayment,
  createUpcomingRenewalPayment,
  sendUpcomingPaymentReminderEmail,
  getMySubscription,
  selectPlan,
  cancelSubscription,
  toggleAutoRenew,
} from "@/lib/api/subscription";
import { getPaymentHistory, getPaymentStatus } from "@/lib/api/payment";
import { Be_Vietnam_Pro } from "next/font/google";
import type {
  BillingCycle,
  MySubscriptionResponse,
  UpcomingRenewalPaymentResponse,
  SelectPlanResponse,
  SubscriptionTier,
  TenantSubscriptionPlanResponse,
} from "@/lib/api/subscription";
import { getStoredUser } from "@/lib/auth-store";
import { useLanguageStore } from "@/lib/language-store";
import { notifyTenantSubscriptionUpdated } from "@/lib/subscription-sync";
import { translations } from "@/lib/translations";
import { toast } from "@/components/ui/AlertProvider";

type TabId = "plans" | "history" | "upcoming";

const TIER_LABEL_VI: Record<SubscriptionTier, string> = {
  TRIAL: "Dùng thử",
  STARTER: "Khởi đầu",
  STANDARD: "Tiêu chuẩn",
  ENTERPRISE: "Doanh nghiệp",
};
const TIER_LABEL_EN: Record<SubscriptionTier, string> = {
  TRIAL: "Trial",
  STARTER: "Starter",
  STANDARD: "Standard",
  ENTERPRISE: "Enterprise",
};

const TIER_ORDER: SubscriptionTier[] = ["TRIAL", "STARTER", "STANDARD", "ENTERPRISE"];
const FALLBACK_PLAN_CARDS: SubscriptionTier[] = ["STARTER", "STANDARD", "ENTERPRISE"];
const POPULAR_TIER: SubscriptionTier = "STANDARD";
const UPCOMING_RENEWAL_DAYS = 7;

const PLAN_FEATURES_VI: Record<SubscriptionTier, string[]> = {
  TRIAL: [
    "Dùng thử miễn phí 14 ngày",
    "Đủ chức năng để trải nghiệm chatbot nội bộ",
    "Không tự động gia hạn",
  ],
  STARTER: [
    "Phù hợp nhóm nhỏ bắt đầu triển khai AI nội bộ",
    "Quản lý tài liệu và truy vấn chatbot cơ bản",
    "Chi phí tối ưu cho giai đoạn khởi động",
  ],
  STANDARD: [
    "Tối ưu cho doanh nghiệp đang mở rộng",
    "Hiệu năng tốt hơn cho tần suất hỏi đáp cao",
    "Cân bằng giữa chi phí và năng lực vận hành",
  ],
  ENTERPRISE: [
    "Dành cho tổ chức lớn, yêu cầu cao",
    "Ưu tiên khả năng mở rộng và mức sử dụng lớn",
    "Phù hợp triển khai toàn diện nhiều phòng ban",
  ],
};

const PLAN_FEATURES_EN: Record<SubscriptionTier, string[]> = {
  TRIAL: [
    "Free for a 14-day trial",
    "Enough features to experience internal chatbot usage",
    "No auto-renewal",
  ],
  STARTER: [
    "Best for small teams starting with internal AI",
    "Core document management and chatbot usage",
    "Cost-efficient for early rollout",
  ],
  STANDARD: [
    "Ideal for growing organizations",
    "Better capacity for frequent chatbot interactions",
    "Balanced cost and operational capability",
  ],
  ENTERPRISE: [
    "Built for large organizations with high demand",
    "Prioritizes scale and higher usage limits",
    "Great for company-wide multi-department rollout",
  ],
};

const pricingFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

function tierDisplayName(tier: SubscriptionTier, lang: "vi" | "en"): string {
  return lang === "vi" ? TIER_LABEL_VI[tier] : TIER_LABEL_EN[tier];
}

function isTierCode(value: string | undefined): value is SubscriptionTier {
  return !!value && TIER_ORDER.includes(value as SubscriptionTier);
}

function parsePlanFeatures(features: string | undefined): string[] {
  if (!features) return [];
  if (features.includes("✅")) {
    return features
      .split("✅")
      .map((item) => item.replace(/^[\s\-•,]+/, "").trim())
      .filter(Boolean);
  }
  return features
    .split(/\r?\n|;/)
    .map((item) => item.replace(/^[\s\-•,]+/, "").trim())
    .filter(Boolean);
}

function formatTierPrice(
  plan: TenantSubscriptionPlanResponse | undefined,
  cycle: BillingCycle,
  lang: "vi" | "en"
): string {
  if (!plan) return "—";

  const raw =
    cycle === "YEARLY"
      ? plan.yearlyPrice
      : cycle === "QUARTERLY"
        ? plan.quarterlyPrice
        : plan.monthlyPrice;

  if (raw == null) return "—";
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return "—";
  if (amount === 0) return lang === "en" ? "Free" : "Miễn phí";

  const locale = lang === "en" ? "en-US" : "vi-VN";
  const currency = plan.currency ?? "VND";
  return currency === "VND"
    ? `${amount.toLocaleString(locale)}đ`
    : `${amount.toLocaleString(locale)} ${currency}`;
}

function getTierAmount(
  plan: TenantSubscriptionPlanResponse | undefined,
  cycle: BillingCycle
): number | null {
  if (!plan) return null;
  const raw =
    cycle === "YEARLY"
      ? plan.yearlyPrice
      : cycle === "QUARTERLY"
        ? plan.quarterlyPrice
        : plan.monthlyPrice;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function formatAmount(
  amount: number | null,
  currency: string | undefined,
  lang: "vi" | "en"
): string {
  if (amount == null) return "—";
  if (amount === 0) return lang === "en" ? "Free" : "Miễn phí";
  const locale = lang === "en" ? "en-US" : "vi-VN";
  const unit = currency ?? "VND";
  return unit === "VND"
    ? `${amount.toLocaleString(locale)}đ`
    : `${amount.toLocaleString(locale)} ${unit}`;
}

function formatDate(dateStr: string | undefined, lang: "vi" | "en"): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === "en" ? "en-US" : "vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function daysUntilDate(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const targetDate = new Date(dateStr);
  if (Number.isNaN(targetDate.getTime())) return null;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetStart = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((targetStart.getTime() - todayStart.getTime()) / msPerDay);
}

export default function TenantAdminSubscriptionPage() {
  const [activeTab, setActiveTab] = useState<TabId>("plans");
  const [subscription, setSubscription] = useState<MySubscriptionResponse | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [availablePlans, setAvailablePlans] = useState<TenantSubscriptionPlanResponse[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof getPaymentHistory>>>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [pressedTier, setPressedTier] = useState<SubscriptionTier | undefined>(undefined);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalTier, setPlanModalTier] = useState<SubscriptionTier | undefined>(undefined);
  const [modalBillingCycle, setModalBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [paymentPending, setPaymentPending] = useState<SelectPlanResponse | undefined>(undefined);
  const [selectPlanLoading, setSelectPlanLoading] = useState(false);
  const [selectPlanError, setSelectPlanError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);
  const [upcomingPayment, setUpcomingPayment] = useState<UpcomingRenewalPaymentResponse | null>(null);
  const [upcomingPaymentLoading, setUpcomingPaymentLoading] = useState(false);
  const [upcomingPaymentActionLoading, setUpcomingPaymentActionLoading] = useState(false);
  const [upcomingPaymentError, setUpcomingPaymentError] = useState<string | null>(null);
  const [upcomingReminderLoading, setUpcomingReminderLoading] = useState(false);
  const [upcomingReminderMessage, setUpcomingReminderMessage] = useState<string | null>(null);
  const [showUpcomingPaymentQr, setShowUpcomingPaymentQr] = useState(false);
  const [successActivatedSubscription, setSuccessActivatedSubscription] = useState<MySubscriptionResponse | null>(null);
  const { language } = useLanguageStore();
  const t = translations[language];

  const loadSubscription = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const tenantId = getStoredUser()?.tenantId ?? null;
    if (!silent) {
      setSubscriptionLoading(true);
    }
    try {
      const data = await getMySubscription();
      setSubscription(data);
      notifyTenantSubscriptionUpdated(tenantId, data);
      return data;
    } catch {
      setSubscription(null);
      notifyTenantSubscriptionUpdated(tenantId, null);
      return null;
    } finally {
      if (!silent) {
        setSubscriptionLoading(false);
      }
    }
  }, []);

  const loadAvailablePlans = useCallback(() => {
    setPlansLoading(true);
    getAvailableSubscriptionPlans()
      .then(setAvailablePlans)
      .catch(() => setAvailablePlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  const loadPayments = useCallback(() => {
    setPaymentsLoading(true);
    getPaymentHistory()
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, []);

  const sortedPlans = useMemo(
    () =>
      [...availablePlans].sort((a, b) => {
        const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.code ?? "").localeCompare(b.code ?? "");
      }),
    [availablePlans]
  );

  const planMap = useMemo(() => {
    const map = new Map<SubscriptionTier, TenantSubscriptionPlanResponse>();
    sortedPlans.forEach((plan) => {
      if (!isTierCode(plan.code) || map.has(plan.code)) return;
      map.set(plan.code, plan);
    });
    return map;
  }, [sortedPlans]);

  const planCards = useMemo<SubscriptionTier[]>(() => {
    const apiPlanCards = Array.from(planMap.keys());
    return apiPlanCards.length > 0 ? apiPlanCards : FALLBACK_PLAN_CARDS;
  }, [planMap]);
  const planGridColumnsClass =
    planCards.length >= 4
      ? "xl:grid-cols-4"
      : planCards.length === 3
        ? "xl:grid-cols-3"
        : "xl:grid-cols-2";

  const modalPlanData = planModalTier ? planMap.get(planModalTier) : undefined;
  const modalFeatures = useMemo(() => {
    if (!planModalTier) return [] as string[];
    const parsed = parsePlanFeatures(modalPlanData?.features);
    if (parsed.length > 0) return parsed;
    return language === "en" ? PLAN_FEATURES_EN[planModalTier] : PLAN_FEATURES_VI[planModalTier];
  }, [language, modalPlanData?.features, planModalTier]);
  const modalAmount = planModalTier === "TRIAL" ? 0 : getTierAmount(modalPlanData, modalBillingCycle);

  useEffect(() => {
    void loadSubscription();
    loadAvailablePlans();
  }, [loadAvailablePlans, loadSubscription]);

  useEffect(() => {
    if (activeTab === "history") loadPayments();
  }, [activeTab, loadPayments]);

  const handleConfirmPay = async () => {
    setSelectPlanError(null);
    setSelectPlanLoading(true);
    try {
      if (!planModalTier) throw new Error("Chọn gói trước khi thanh toán");
      const data = await selectPlan(planModalTier, modalBillingCycle);
      if ("payment_id" in data && data.payment_id) {
        setPaymentPending(data);
      } else {
        void handleSubscriptionUpdated();
        setPlanModalOpen(false);
        setPlanModalTier(undefined);
      }
    } catch (e) {
      setSelectPlanError(e instanceof Error ? e.message : "Chọn gói thất bại");
    } finally {
      setSelectPlanLoading(false);
    }
  };

  const handleSubscriptionUpdated = async (options?: { showSuccessPopup?: boolean }) => {
    const latestSubscription = await loadSubscription({ silent: true });
    loadAvailablePlans();
    setPaymentPending(undefined);
    setShowUpcomingPaymentQr(false);
    setUpcomingReminderMessage(null);
    if (activeTab === "history") loadPayments();
    if (options?.showSuccessPopup && latestSubscription) {
      setSuccessActivatedSubscription(latestSubscription);
    }
  };

  const handleSelectTier = (tier: SubscriptionTier) => {
    setPressedTier(tier);
    setPlanModalTier(tier);
    setModalBillingCycle("MONTHLY");
    setPlanModalOpen(true);
    setPaymentPending(undefined);
    setSelectPlanError(null);
    window.setTimeout(() => {
      setPressedTier((current) => (current === tier ? undefined : current));
    }, 260);
  };

  const handleClosePlanModal = () => {
    if (selectPlanLoading) return;
    setPlanModalOpen(false);
    setPlanModalTier(undefined);
    setPaymentPending(undefined);
    setSelectPlanError(null);
  };

  const handleToggleAutoRenew = async () => {
    if (!subscription || autoRenewLoading) return;

    const isTrialSubscription =
      Boolean(subscription.isTrial) ||
      subscription.tier === "TRIAL" ||
      subscription.status === "TRIAL";

    if (isTrialSubscription) {
      toast.warning(
        language === "en"
          ? "Auto-renew is not available for free trial plans."
          : "Gói dùng thử miễn phí không hỗ trợ tự động gia hạn."
      );
      return;
    }

    setAutoRenewLoading(true);
    try {
      await toggleAutoRenew(!subscription.autoRenew);
      setUpcomingPaymentError(null);
      setUpcomingReminderMessage(null);
      setShowUpcomingPaymentQr(false);
      void loadSubscription({ silent: true });
    } catch (e) {
      console.error("Failed to toggle auto-renew:", e);
      toast.error(
        e instanceof Error
          ? e.message
          : language === "en"
            ? "Failed to update auto-renew"
            : "Cập nhật auto-renew thất bại"
      );
    } finally {
      setAutoRenewLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelReason.trim() || cancelLoading) return;
    setCancelLoading(true);
    try {
      await cancelSubscription(cancelReason);
      void loadSubscription();
      setCancelModalOpen(false);
      setCancelReason("");
    } catch (e) {
      console.error("Failed to cancel subscription:", e);
    } finally {
      setCancelLoading(false);
    }
  };

  const currentPlanData = subscription ? planMap.get(subscription.tier) : undefined;
  const currentPlanFeatures = parsePlanFeatures(currentPlanData?.features);
  const isTrialSubscription =
    Boolean(subscription?.isTrial) ||
    subscription?.tier === "TRIAL" ||
    subscription?.status === "TRIAL";
  const hasActiveSubscription = subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIAL");
  const daysUntilSubscriptionEnd = useMemo(
    () => daysUntilDate(subscription?.endDate),
    [subscription?.endDate]
  );
  const hasUpcomingData = Boolean(
    subscription &&
      subscription.status === "ACTIVE" &&
      subscription.autoRenew &&
      daysUntilSubscriptionEnd === UPCOMING_RENEWAL_DAYS
  );

  const upcomingPaymentPending = useMemo<SelectPlanResponse | undefined>(() => {
    if (!upcomingPayment?.payment_id || !upcomingPayment.transaction_code) return undefined;
    return {
      payment_id: upcomingPayment.payment_id,
      subscription_id: upcomingPayment.subscription_id,
      transaction_code: upcomingPayment.transaction_code,
      amount: upcomingPayment.amount ?? subscription?.price ?? 0,
      currency: upcomingPayment.currency ?? subscription?.currency ?? "VND",
      qr_image_url: upcomingPayment.qr_image_url,
      qr_content: upcomingPayment.qr_content,
      expires_at: upcomingPayment.expires_at,
      tier: upcomingPayment.tier ?? subscription?.tier ?? "STARTER",
      billing_cycle: upcomingPayment.billing_cycle ?? subscription?.billingCycle ?? "MONTHLY",
      bank_account: upcomingPayment.bank_account,
      bank_name: upcomingPayment.bank_name,
      account_name: upcomingPayment.account_name,
      polling_interval_seconds: upcomingPayment.polling_interval_seconds,
    };
  }, [upcomingPayment, subscription?.billingCycle, subscription?.currency, subscription?.price, subscription?.tier]);

  useEffect(() => {
    if (!hasUpcomingData) {
      setUpcomingPayment(null);
      setUpcomingPaymentError(null);
      setUpcomingReminderMessage(null);
      setShowUpcomingPaymentQr(false);
      return;
    }

    setUpcomingPaymentLoading(true);
    setUpcomingPaymentError(null);
    getUpcomingRenewalPayment()
      .then((data) => setUpcomingPayment(data))
      .catch((e) => {
        setUpcomingPayment(null);
        setUpcomingPaymentError(e instanceof Error ? e.message : language === "en" ? "Cannot load upcoming payment" : "Không tải được giao dịch sắp thanh toán");
      })
      .finally(() => setUpcomingPaymentLoading(false));
  }, [hasUpcomingData, language]);

  const handleUpcomingPaymentAction = async () => {
    if (showUpcomingPaymentQr) {
      setShowUpcomingPaymentQr(false);
      return;
    }
    if (upcomingPaymentPending) {
      setShowUpcomingPaymentQr(true);
      return;
    }

    setUpcomingPaymentActionLoading(true);
    setUpcomingPaymentError(null);
    try {
      const data = await createUpcomingRenewalPayment();
      setUpcomingPayment(data);
      setShowUpcomingPaymentQr(true);
    } catch (e) {
      setUpcomingPaymentError(e instanceof Error ? e.message : language === "en" ? "Cannot create upcoming payment" : "Không tạo được giao dịch sắp thanh toán");
    } finally {
      setUpcomingPaymentActionLoading(false);
    }
  };

  const handleSendUpcomingReminder = async () => {
    setUpcomingReminderLoading(true);
    setUpcomingPaymentError(null);
    setUpcomingReminderMessage(null);
    try {
      const data = await sendUpcomingPaymentReminderEmail();
      setUpcomingPayment(data);
      setUpcomingReminderMessage(
        data.message ?? (language === "en" ? "Reminder email sent." : "Đã gửi email nhắc thanh toán.")
      );
    } catch (e) {
      setUpcomingPaymentError(e instanceof Error ? e.message : language === "en" ? "Cannot send reminder email" : "Không gửi được email nhắc thanh toán");
    } finally {
      setUpcomingReminderLoading(false);
    }
  };

  return (
      <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
        {/* Tabs */}
        <section className="mb-6">
          <SubscriptionTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            language={language === "en" ? "en" : "vi"}
          />
        </section>

        {/* Plans Tab */}
        {activeTab === "plans" && (
          <>
            {/* Current Plan Section */}
            <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {language === "en" ? "Current Plan" : "Gói hiện tại"}
            </h2>
            {hasActiveSubscription && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                subscription.status === "ACTIVE" 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : subscription.status === "TRIAL"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  subscription.status === "ACTIVE" 
                    ? "bg-emerald-500"
                    : subscription.status === "TRIAL"
                    ? "bg-blue-500"
                    : "bg-zinc-500"
                }`} />
                {subscription.status === "ACTIVE" 
                  ? language === "en" ? "Active" : "Đang hoạt động"
                  : subscription.status === "TRIAL"
                  ? language === "en" ? "Trial" : "Dùng thử"
                  : subscription.status}
              </span>
            )}
          </div>

          {subscriptionLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-500 dark:border-zinc-700 dark:border-t-emerald-400" />
            </div>
          ) : !hasActiveSubscription ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/50 dark:bg-amber-900/20">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {language === "en" 
                  ? "You don't have an active subscription. Choose a plan below to get started." 
                  : "Bạn chưa có gói đăng ký nào. Chọn gói phù hợp bên dưới để bắt đầu."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              {/* Plan Info */}
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {language === "en" ? "Plan" : "Gói"}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                    {tierDisplayName(subscription.tier, language === "en" ? "en" : "vi")}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {language === "en" ? "Price" : "Giá"}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                    {subscription.price != null 
                      ? formatAmount(subscription.price, subscription.currency, language === "en" ? "en" : "vi")
                      : language === "en" ? "Free" : "Miễn phí"}
                    {subscription.price != null && subscription.billingCycle && (
                      <span className="text-base font-normal text-zinc-500">
                        /{subscription.billingCycle === "YEARLY" 
                          ? language === "en" ? "year" : "năm"
                          : subscription.billingCycle === "QUARTERLY"
                          ? language === "en" ? "quarter" : "quý"
                          : language === "en" ? "month" : "tháng"}
                      </span>
                    )}
                  </p>
                </div>

                {currentPlanFeatures.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                      {language === "en" ? "Features" : "Tính năng"}
                    </p>
                    <ul className="space-y-2">
                      {currentPlanFeatures.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Billing Info & Actions */}
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {language === "en" ? "Billing Information" : "Thông tin thanh toán"}
                  </p>
                  <div className="space-y-2 text-sm">
                    {subscription.nextBillingDate && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {language === "en" ? "Next billing date:" : "Ngày thanh toán tiếp theo:"}
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {formatDate(subscription.nextBillingDate, language === "en" ? "en" : "vi")}
                        </span>
                      </div>
                    )}
                    {subscription.endDate && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {language === "en" ? "End date:" : "Ngày kết thúc:"}
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {formatDate(subscription.endDate, language === "en" ? "en" : "vi")}
                        </span>
                      </div>
                    )}
                    {!isTrialSubscription && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {language === "en" ? "Auto-renew:" : "Tự động gia hạn:"}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleAutoRenew}
                          disabled={autoRenewLoading}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            subscription.autoRenew 
                              ? "bg-emerald-500" 
                              : "bg-zinc-300 dark:bg-zinc-700"
                          } ${autoRenewLoading ? "opacity-50" : ""}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            subscription.autoRenew ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {language === "en" ? "Cancel Plan" : "Hủy gói"}
                </button>
              </div>
            </div>
          )}
        </section>

            {/* Available Plans Section - OLD DESIGN */}
            <div className={`${pricingFont.className} mb-5`}>
              <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {language === "en" ? "Select your plan" : "Chọn hạng gói phù hợp"}
              </h3>
              {plansLoading && (
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {language === "en" ? "Loading available plans..." : "Đang tải danh sách gói..."}
                </p>
              )}
              <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 ${planGridColumnsClass}`}>
              {planCards.map((tier) => {
                const isPressing = pressedTier === tier;
                const isPopular = tier === POPULAR_TIER;
                const isCurrentPlan = !!(subscription?.tier === tier && hasActiveSubscription);
                const planData = planMap.get(tier);
                const apiFeatures = parsePlanFeatures(planData?.features);
                const fallbackFeatures =
                  language === "en" ? PLAN_FEATURES_EN[tier] : PLAN_FEATURES_VI[tier];
                const features = apiFeatures.length > 0 ? apiFeatures : fallbackFeatures;
                const cycleLabel = language === "en" ? "month" : "tháng";
                
                return (
                  <article
                    key={tier}
                    className={`relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-white px-5 pb-5 text-zinc-900 shadow-[0_12px_30px_rgba(15,23,42,0.09)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-[#111111] dark:text-white dark:shadow-none ${
                      isPopular
                        ? "z-10 border-2 border-emerald-400 dark:border-emerald-500"
                        : "border-zinc-200 dark:border-[#222222]"
                    } hover:-translate-y-1 hover:border-zinc-300 dark:hover:border-[#343434] ${isPressing ? "scale-[0.985]" : "scale-100"}`}
                  >
                    {isPopular && (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-emerald-100/65 via-transparent to-transparent dark:from-emerald-500/14" />
                        <div className="absolute inset-x-0 top-0 z-20">
                          <span className="block bg-emerald-400 py-2 text-center text-xs font-bold uppercase tracking-wide text-white dark:bg-emerald-500 dark:text-white">
                            {language === "en" ? "Most Popular" : "Phổ biến nhất"}
                          </span>
                        </div>
                      </>
                    )}

                    {isCurrentPlan && (
                      <div className={`absolute right-3 z-20 ${isPopular ? "top-11" : "top-3"}`}>
                        <span className="inline-flex rounded-full bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white">
                          {language === "en" ? "Current plan" : "Gói đang dùng"}
                        </span>
                      </div>
                    )}

                    <div className={`relative z-10 flex h-full flex-col ${isPopular ? "pt-12" : "pt-5"}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500">
                        {language === "en" ? "Plan" : "Hạng gói"}
                      </p>

                      <h4 className="mt-1 text-5xl leading-tight font-bold text-zinc-900 dark:text-zinc-100">
                        {tierDisplayName(tier, language === "en" ? "en" : "vi")}
                      </h4>

                      {tier === "TRIAL" ? (
                        <>
                          <p className="mt-3 text-[3.05rem] leading-none font-extrabold text-zinc-950 dark:text-zinc-50">
                            {language === "en" ? "Free" : "Miễn phí"}
                          </p>
                          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-500">
                            {language === "en" ? "for 14 days" : "trong 14 ngày"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-3 text-[3.05rem] leading-none font-extrabold text-zinc-950 dark:text-zinc-50">
                            {formatTierPrice(planData, "MONTHLY", language === "en" ? "en" : "vi")}
                          </p>
                          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-500">/{cycleLabel}</p>
                        </>
                      )}

                      {planData?.description ? (
                        <p className="mt-4 min-h-[48px] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {planData.description}
                        </p>
                      ) : (
                        <div className="mt-4 min-h-[48px]" />
                      )}

                      <ul className="mt-6 flex-1 space-y-3 text-base text-zinc-700 dark:text-zinc-200">
                        {features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <span className="mt-2 text-[10px] leading-none text-zinc-400 dark:text-zinc-500">●</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-6">
                        <button
                          type="button"
                          disabled={isCurrentPlan}
                          onClick={() => handleSelectTier(tier)}
                          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 active:scale-[0.98] ${
                            isCurrentPlan
                              ? "cursor-not-allowed border border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-[#1a1a1a] dark:text-zinc-500"
                              : "bg-emerald-500 text-white hover:bg-emerald-400 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500"
                          }`}
                        >
                          {isCurrentPlan
                            ? language === "en"
                              ? "Currently active"
                              : "Đang sử dụng"
                            : language === "en"
                              ? "Select this plan"
                              : "Chọn gói này"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
            </div>
          </>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <BillingHistory payments={payments} loading={paymentsLoading} />
        )}

        {/* Upcoming Tab */}
        {activeTab === "upcoming" && (
          <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-lg dark:border-emerald-900/40 dark:bg-zinc-900">
            {hasUpcomingData && subscription ? (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {language === "en" ? "Upcoming Renewal Transaction" : "Giao dịch sắp thanh toán"}
                    </h2>
                  </div>
                  {upcomingPayment?.payment_available && upcomingPayment?.status ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {upcomingPayment.status}
                    </span>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-600 dark:text-zinc-400">{language === "en" ? "Plan:" : "Gói:"}</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {tierDisplayName(subscription.tier, language === "en" ? "en" : "vi")}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-600 dark:text-zinc-400">{language === "en" ? "Cycle:" : "Chu kỳ:"}</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {subscription.billingCycle === "YEARLY"
                          ? language === "en"
                            ? "Yearly"
                            : "Hàng năm"
                          : subscription.billingCycle === "QUARTERLY"
                            ? language === "en"
                              ? "Quarterly"
                              : "Hàng quý"
                            : language === "en"
                              ? "Monthly"
                              : "Hàng tháng"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-600 dark:text-zinc-400">{language === "en" ? "Amount:" : "Số tiền:"}</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatAmount(
                          (upcomingPayment?.amount as number | null | undefined) ?? subscription.price ?? null,
                          upcomingPayment?.currency ?? subscription.currency,
                          language === "en" ? "en" : "vi"
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-600 dark:text-zinc-400">{language === "en" ? "Next billing:" : "Kỳ thanh toán:"}</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatDate(
                          (upcomingPayment?.next_billing_date as string | undefined) ?? subscription.nextBillingDate,
                          language === "en" ? "en" : "vi"
                        )}
                      </span>
                    </div>
                    {typeof daysUntilSubscriptionEnd === "number" ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {language === "en" ? "Days remaining:" : "Số ngày còn lại:"}
                        </span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {daysUntilSubscriptionEnd}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {upcomingPaymentLoading ? (
                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {language === "en" ? "Loading upcoming transaction..." : "Đang tải giao dịch sắp thanh toán..."}
                    </p>
                  ) : null}

                  {upcomingPaymentError ? (
                    <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{upcomingPaymentError}</p>
                  ) : null}

                  {upcomingReminderMessage ? (
                    <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">{upcomingReminderMessage}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleUpcomingPaymentAction()}
                      disabled={upcomingPaymentLoading || upcomingPaymentActionLoading}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {upcomingPaymentActionLoading
                        ? language === "en"
                          ? "Preparing..."
                          : "Đang chuẩn bị..."
                        : showUpcomingPaymentQr
                          ? language === "en"
                            ? "Hide QR"
                            : "Ẩn QR"
                          : upcomingPaymentPending
                            ? language === "en"
                              ? "Show QR"
                              : "Xem QR"
                            : language === "en"
                              ? "Pay now"
                              : "Thanh toán ngay"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleSendUpcomingReminder()}
                      disabled={upcomingReminderLoading}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {upcomingReminderLoading
                        ? language === "en"
                          ? "Sending..."
                          : "Đang gửi..."
                        : language === "en"
                          ? "Send reminder email"
                          : "Gửi email nhắc thanh toán"}
                    </button>
                  </div>

                  {showUpcomingPaymentQr && upcomingPaymentPending ? (
                    <div className="mt-4">
                      <PaymentPendingSection
                        data={upcomingPaymentPending}
                        language={language === "en" ? "en" : "vi"}
                        onClose={() => setShowUpcomingPaymentQr(false)}
                        onSuccess={() => {
                          void handleSubscriptionUpdated({ showSuccessPopup: true });
                        }}
                        compact
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "No upcoming renewal transaction yet." : "Chưa có"}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Plan Selection Modal */}
        {planModalOpen && planModalTier && (
          <PlanCheckoutModal
            language={language === "en" ? "en" : "vi"}
            tier={planModalTier}
            planData={modalPlanData}
            features={modalFeatures}
            billingCycle={modalBillingCycle}
            totalAmount={modalAmount}
            onBillingCycleChange={setModalBillingCycle}
            onClose={handleClosePlanModal}
            onConfirm={handleConfirmPay}
            confirmLoading={selectPlanLoading}
            confirmError={selectPlanError}
            paymentPending={paymentPending}
            onPaymentSuccess={() => {
              void handleSubscriptionUpdated({ showSuccessPopup: true });
              setPlanModalOpen(false);
              setPlanModalTier(undefined);
            }}
          />
        )}

        {successActivatedSubscription && (
          <SubscriptionActivatedModal
            language={language === "en" ? "en" : "vi"}
            subscription={successActivatedSubscription}
            onClose={() => setSuccessActivatedSubscription(null)}
          />
        )}

        {/* Cancel Subscription Modal */}
        {cancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {language === "en" ? "Cancel Subscription" : "Hủy gói đăng ký"}
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {language === "en" 
                  ? "Please tell us why you're canceling. This helps us improve our service." 
                  : "Vui lòng cho chúng tôi biết lý do hủy. Điều này giúp chúng tôi cải thiện dịch vụ."}
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={language === "en" ? "Reason for cancellation..." : "Lý do hủy..."}
                className="mt-4 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
                rows={4}
              />
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCancelModalOpen(false);
                    setCancelReason("");
                  }}
                  disabled={cancelLoading}
                  className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                >
                  {language === "en" ? "Keep Plan" : "Giữ gói"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={!cancelReason.trim() || cancelLoading}
                  className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700"
                >
                  {cancelLoading 
                    ? language === "en" ? "Canceling..." : "Đang hủy..."
                    : language === "en" ? "Cancel Plan" : "Hủy gói"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

function SubscriptionActivatedModal({
  language,
  subscription,
  onClose,
}: {
  language: "vi" | "en";
  subscription: MySubscriptionResponse;
  onClose: () => void;
}) {
  const cycleLabel =
    subscription.billingCycle === "YEARLY"
      ? language === "en"
        ? "Yearly"
        : "Hàng năm"
      : subscription.billingCycle === "QUARTERLY"
        ? language === "en"
          ? "Quarterly"
          : "Hàng quý"
        : language === "en"
          ? "Monthly"
          : "Hàng tháng";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_20px_70px_rgba(16,185,129,0.25)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-6 text-white">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-3 text-2xl font-bold">
            {language === "en" ? "Subscription activated successfully" : "Kích hoạt subscription thành công"}
          </h3>
          <p className="mt-1 text-sm text-white/90">
            {language === "en"
              ? "Your plan is now active. Here are your billing and usage details."
              : "Gói của bạn đã được kích hoạt. Dưới đây là thông tin thanh toán và hạn mức sử dụng."}
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow
                label={language === "en" ? "Plan" : "Gói"}
                value={tierDisplayName(subscription.tier, language)}
              />
              <InfoRow
                label={language === "en" ? "Billing cycle" : "Chu kỳ"}
                value={cycleLabel}
              />
              <InfoRow
                label={language === "en" ? "Activation date" : "Ngày kích hoạt"}
                value={formatDate(subscription.startDate, language)}
              />
              <InfoRow
                label={language === "en" ? "End date" : "Ngày hết hạn"}
                value={formatDate(subscription.endDate, language)}
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {language === "en" ? "Included usage" : "Hạn mức sử dụng"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <UsageCard
                title={language === "en" ? "Max users" : "Người dùng tối đa"}
                value={subscription.maxUsers}
              />
              <UsageCard
                title={language === "en" ? "Max documents" : "Tài liệu tối đa"}
                value={subscription.maxDocuments}
              />
              <UsageCard
                title={language === "en" ? "Storage limit (GB)" : "Dung lượng lưu trữ (GB)"}
                value={subscription.maxStorageGb}
              />
              <UsageCard
                title={language === "en" ? "API calls limit" : "Giới hạn API calls"}
                value={subscription.maxApiCalls}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {language === "en" ? "Continue" : "Tiếp tục"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function UsageCard({ title, value }: { title: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{title}</p>
      <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
        {value == null ? "—" : value.toLocaleString()}
      </p>
    </div>
  );
}

function PlanCheckoutModal({
  language,
  tier,
  planData,
  features,
  billingCycle,
  totalAmount,
  onBillingCycleChange,
  onClose,
  onConfirm,
  confirmLoading,
  confirmError,
  paymentPending,
  onPaymentSuccess,
}: {
  language: "vi" | "en";
  tier: SubscriptionTier;
  planData: TenantSubscriptionPlanResponse | undefined;
  features: string[];
  billingCycle: BillingCycle;
  totalAmount: number | null;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  confirmLoading: boolean;
  confirmError: string | null;
  paymentPending: SelectPlanResponse | undefined;
  onPaymentSuccess: () => void;
}) {
  const isTrial = tier === "TRIAL";
  const [entered, setEntered] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleStartClose = useCallback(() => {
    if (isClosing || confirmLoading) return;
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
    }, 220);
  }, [confirmLoading, isClosing, onClose]);

  const modalVisible = entered && !isClosing;

  const cycleText =
    billingCycle === "YEARLY"
      ? language === "en" ? "year" : "năm"
      : billingCycle === "QUARTERLY"
        ? language === "en" ? "quarter" : "quý"
        : language === "en" ? "month" : "tháng";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity duration-200 ${
        modalVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`${pricingFont.className} max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900 ${
          modalVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.98] opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {language === "en" ? "Confirm Subscription" : "Xác nhận đăng ký"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {language === "en"
                ? "Review plan details before proceeding"
                : "Xem lại thông tin gói trước khi tiếp tục"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {language === "en" ? "Close" : "Đóng"}
          </button>
        </div>

        {paymentPending ? (
          <div className="p-6">
            <PaymentPendingSection
              data={paymentPending}
              language={language}
              onClose={handleStartClose}
              onSuccess={onPaymentSuccess}
              compact
            />
          </div>
        ) : (
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h4 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {tierDisplayName(tier, language)}
              </h4>
              {isTrial ? (
                <>
                  <p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">
                    {language === "en" ? "Free" : "Miễn phí"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {language === "en" ? "for 14 days" : "trong 14 ngày"}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">
                    {formatAmount(totalAmount, planData?.currency, language)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">/{cycleText}</p>
                </>
              )}

              {planData?.description && (
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{planData.description}</p>
              )}

              {features.length > 0 && (
                <ul className="mt-6 space-y-2">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-4">
              {!isTrial && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {language === "en" ? "Billing cycle" : "Chu kỳ thanh toán"}
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) => onBillingCycleChange(e.target.value as BillingCycle)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value="MONTHLY">{language === "en" ? "Monthly" : "Hàng tháng"}</option>
                    <option value="QUARTERLY">{language === "en" ? "Quarterly" : "Hàng quý"}</option>
                    <option value="YEARLY">{language === "en" ? "Yearly" : "Hàng năm"}</option>
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                <p className="text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                  {language === "en" ? "Total amount" : "Tổng thanh toán"}
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatAmount(totalAmount, planData?.currency, language)}
                </p>
              </div>

              {confirmError && (
                <p className="text-sm text-red-600 dark:text-red-400">{confirmError}</p>
              )}

              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => void onConfirm()}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                {confirmLoading
                  ? language === "en" ? "Processing..." : "Đang xử lý..."
                  : isTrial
                  ? language === "en" ? "Activate Trial" : "Kích hoạt dùng thử"
                  : language === "en" ? "Confirm & Pay" : "Xác nhận & Thanh toán"}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentPendingSection({
  data,
  language,
  onClose,
  onSuccess,
  compact = false,
}: {
  data: SelectPlanResponse;
  language: "vi" | "en";
  onClose: () => void;
  onSuccess: () => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [failedQrUrl, setFailedQrUrl] = useState<string | null>(null);
  const locale = language === "en" ? "en-US" : "vi-VN";
  const amountText =
    data.amount == null
      ? "—"
      : (data.currency ?? "VND") === "VND"
        ? `${data.amount.toLocaleString(locale)}đ`
        : `${data.amount.toLocaleString(locale)} ${data.currency}`;
  const statusText =
    status === "SUCCESS"
      ? language === "en" ? "Payment successful" : "Thanh toán thành công"
      : status === "PENDING"
        ? language === "en" ? "Waiting for confirmation" : "Đang chờ xác nhận"
        : status;

  const getQRImageUrl = () => {
    if (!data.qr_image_url) return null;
    
    if (data.qr_image_url.includes('${')) {
      const bankCode = data.bank_name === "TPBANK" ? "970423" : "970423";
      const bankAccount = data.bank_account || "";
      const accountName = data.account_name || "";
      const amount = data.amount || 0;
      const addInfo = encodeURIComponent(data.transaction_code || "");
      
      return `https://img.vietqr.io/image/${bankCode}-${bankAccount}-compact2.jpg?amount=${amount}&addInfo=${addInfo}&accountName=${encodeURIComponent(accountName)}`;
    }
    
    return data.qr_image_url;
  };

  const qrImageUrl = getQRImageUrl();
  const qrLoadFailed = !!qrImageUrl && failedQrUrl === qrImageUrl;

  useEffect(() => {
    if (!data.payment_id || !polling) return;
    const interval = setInterval(async () => {
      try {
        const result = await getPaymentStatus(data.payment_id);
        setStatus(result.status);
        if (result.status === "SUCCESS") {
          setPolling(false);
          onSuccess();
        }
      } catch {
        // keep polling
      }
    }, (data.polling_interval_seconds ?? 5) * 1000);
    return () => clearInterval(interval);
  }, [data.payment_id, data.polling_interval_seconds, polling, onSuccess]);

  return (
    <section className={`${compact ? "" : "mb-8"} rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 dark:border-emerald-900/50 dark:bg-emerald-900/10`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
          {language === "en" ? "Waiting for payment" : "Đang chờ thanh toán"}
        </h3>
        {!compact && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/50"
          >
            {language === "en" ? "Close" : "Đóng"}
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {qrImageUrl && !qrLoadFailed ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {language === "en" ? "Scan QR code to pay" : "Quét mã QR để thanh toán"}
            </p>
            <div className="relative">
              <Image
                src={qrImageUrl}
                alt={language === "en" ? "Payment QR code" : "QR thanh toán"}
                width={256}
                height={256}
                unoptimized
                className="h-64 w-64 rounded-xl border-2 border-emerald-500 bg-white p-2 object-contain shadow-lg"
                onError={() => {
                  setFailedQrUrl(qrImageUrl);
                }}
              />
            </div>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              {language === "en"
                ? "Use your banking app to scan"
                : "Sử dụng app ngân hàng để quét"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-900/20">
            <p className="text-center text-sm text-amber-800 dark:text-amber-200">
              {language === "en"
                ? "QR code unavailable. Please transfer manually."
                : "Mã QR không khả dụng. Vui lòng chuyển khoản thủ công."}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {language === "en" ? "Transaction code" : "Mã giao dịch"}
            </p>
            <p className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {data.transaction_code}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {language === "en" ? "Amount" : "Số tiền"}
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {amountText}
            </p>
          </div>

          {data.bank_account && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {language === "en" ? "Bank details" : "Thông tin ngân hàng"}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">{language === "en" ? "Bank:" : "Ngân hàng:"}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{data.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">{language === "en" ? "Account:" : "Số TK:"}</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-50">{data.bank_account}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">{language === "en" ? "Name:" : "Chủ TK:"}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{data.account_name}</span>
                </div>
              </div>
            </div>
          )}

          {status && (
            <div className={`rounded-xl border p-4 ${
              status === "SUCCESS" 
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20" 
                : status === "PENDING"
                ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            }`}>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {language === "en" ? "Status" : "Trạng thái"}
              </p>
              <p className={`text-sm font-semibold ${
                status === "SUCCESS" 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : status === "PENDING"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}>
                {statusText}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

