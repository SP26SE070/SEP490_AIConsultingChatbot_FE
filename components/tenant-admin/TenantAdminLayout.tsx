"use client";

import { TenantAdminSidebar } from "./TenantAdminSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OnboardingModal } from "@/components/employee/OnboardingModal";
import {
  getMyOnboarding,
  markMyOnboardingModuleCompleted,
  updateMyOnboardingProgress,
} from "@/lib/api/onboarding";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import type { OnboardingMyOverviewResponse } from "@/types/onboarding";
import { motion } from "framer-motion";
import { DashboardAnimatedBackground } from "@/components/ui/DashboardAnimatedBackground";
import { toast } from "@/components/ui/AlertProvider";

interface TenantAdminLayoutProps {
  children: React.ReactNode;
}

type LoadOnboardingOptions = {
  autoOpenIfIncomplete?: boolean;
  silent?: boolean;
  oncePerSession?: boolean;
  showLoading?: boolean;
};

function applyOptimisticModuleComplete(
  overview: OnboardingMyOverviewResponse | null,
  moduleId: string
): OnboardingMyOverviewResponse | null {
  if (!overview) return overview;

  const nowIso = new Date().toISOString();
  let changed = false;

  const modules = overview.modules.map((module) => {
    if (module.id !== moduleId || module.completed) {
      return module;
    }

    changed = true;
    return {
      ...module,
      readPercent: 100,
      completed: true,
      completedAt: nowIso,
      lastViewedAt: nowIso,
    };
  });

  if (!changed) return overview;

  const totalModules = modules.length;
  const completedModules = modules.filter((module) => module.completed).length;
  const progressPercent = totalModules === 0
    ? 100
    : Math.round((completedModules * 100) / totalModules);

  return {
    ...overview,
    modules,
    completedModules,
    progressPercent,
    hasIncompleteModules: completedModules < totalModules,
  };
}

export function TenantAdminLayout({ children }: TenantAdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDashboardHome =
    pathname.replace(/\/$/, "") === "/tenant-admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showSubscriptionRequiredModal, setShowSubscriptionRequiredModal] =
    useState(false);
  const [onboardingOverview, setOnboardingOverview] =
    useState<OnboardingMyOverviewResponse | null>(null);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const [processingModuleId, setProcessingModuleId] = useState<string | null>(
    null
  );
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";

  const autoOpenKey = "tenant-admin-onboarding-auto-opened";

  useEffect(() => {
    if (searchParams.get("subscriptionRequired") === "1") {
      setShowSubscriptionRequiredModal(true);
    }
  }, [searchParams]);

  const loadOnboarding = useCallback(async (options: LoadOnboardingOptions = {}) => {
    const shouldShowLoading = options.showLoading ?? true;
    if (shouldShowLoading) {
      setIsOnboardingLoading(true);
    }

    try {
      const overview = await getMyOnboarding();
      setOnboardingOverview(overview);

      if (options.autoOpenIfIncomplete && overview.hasIncompleteModules) {
        let canAutoOpen = true;
        if (options.oncePerSession) {
          const opened = sessionStorage.getItem(autoOpenKey) === "1";
          canAutoOpen = !opened;
          if (canAutoOpen) {
            sessionStorage.setItem(autoOpenKey, "1");
          }
        }

        if (canAutoOpen) {
          setShowOnboardingModal(true);
        }
      }

      return overview;
    } catch (error) {
      if (!options.silent) {
        toast.error(
          error instanceof Error
            ? error.message
            : isEn
              ? "Unable to load onboarding."
              : "Không tải được onboarding."
        );
      }
      return null;
    } finally {
      if (shouldShowLoading) {
        setIsOnboardingLoading(false);
      }
    }
  }, [isEn]);

  useEffect(() => {
    void loadOnboarding({
      autoOpenIfIncomplete: isDashboardHome,
      oncePerSession: true,
      silent: true,
    });
  }, [isDashboardHome, loadOnboarding]);

  const handleMarkModuleCompleted = useCallback(
    async (moduleId: string) => {
      const previousOverview = onboardingOverview;
      setOnboardingOverview((current) => applyOptimisticModuleComplete(current, moduleId));
      setProcessingModuleId(moduleId);

      try {
        await updateMyOnboardingProgress(moduleId, 100);
        await markMyOnboardingModuleCompleted(moduleId);
        await loadOnboarding({ silent: true, showLoading: false });
        return true;
      } catch (error) {
        setOnboardingOverview(previousOverview);
        toast.error(
          error instanceof Error
            ? error.message
            : isEn
              ? "Unable to update onboarding status."
              : "Không thể cập nhật trạng thái onboarding."
        );
        return false;
      } finally {
        setProcessingModuleId(null);
      }
    },
    [isEn, loadOnboarding, onboardingOverview]
  );

  const onboardingSummary = useMemo(() => {
    if (!onboardingOverview) {
      return {
        total: 0,
        completed: 0,
        progress: 0,
        remaining: 0,
        hasIncomplete: false,
      };
    }

    const remaining = Math.max(
      onboardingOverview.totalModules - onboardingOverview.completedModules,
      0
    );

    return {
      total: onboardingOverview.totalModules,
      completed: onboardingOverview.completedModules,
      progress: onboardingOverview.progressPercent,
      remaining,
      hasIncomplete: onboardingOverview.hasIncompleteModules,
    };
  }, [onboardingOverview]);

  return (
    <>
      <div className="tenant-admin-shell flex h-dvh max-h-dvh w-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent dark:bg-zinc-950">
        <header className="fixed top-0 right-0 left-0 z-50 flex h-16 min-w-0 items-center border-b border-zinc-200/90 bg-white/95 px-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/95 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)] sm:px-5 lg:pl-64 lg:pr-8">
          <span
            className="pointer-events-none absolute bottom-0 left-64 top-0 hidden w-px bg-zinc-200/90 lg:block dark:bg-zinc-800/90"
            aria-hidden
          />
          <DashboardHeader
            title={t.tenantAdmin}
            onMenuClick={() => setSidebarOpen(true)}
            onOpenOnboarding={() => setShowOnboardingModal(true)}
            onboardingButtonLabel={isEn ? "Onboarding" : "Lộ trình onboarding"}
            onboardingBadgeLabel={
              !isOnboardingLoading && onboardingSummary.total > 0
                ? `${onboardingSummary.completed}/${onboardingSummary.total}`
                : null
            }
            showOnboardingButton
          />
        </header>

        <div className="scrollbar-chat-hidden relative flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pt-16 pb-4 sm:px-5 sm:pb-5 lg:pr-8 lg:pl-0 lg:pb-6">
          <TenantAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

          <main
            data-dashboard-animated="true"
            className="relative min-h-full min-w-0 flex-1 overflow-x-hidden bg-transparent px-0 py-2 sm:px-3 lg:border-l lg:border-zinc-200/90 lg:px-4 lg:pl-72 dark:lg:border-zinc-800/90 xl:pl-72"
          >
            <div className="pointer-events-none fixed inset-x-0 bottom-0 top-16 z-0 lg:left-64">
              <DashboardAnimatedBackground accent="emerald" />
            </div>
            <div className="relative z-[1] mx-auto w-full min-w-0 max-w-[min(100%,88rem)] pt-4 sm:pt-6">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
              </motion.div>
            </div>
          </main>
        </div>
      </div>

      <OnboardingModal
        isOpen={showOnboardingModal}
        isLoading={isOnboardingLoading}
        overview={onboardingOverview}
        processingModuleId={processingModuleId}
        onClose={() => setShowOnboardingModal(false)}
        onMarkCompleted={handleMarkModuleCompleted}
      />

      {showSubscriptionRequiredModal && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/70" />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {isEn
                ? "Subscription required"
                : "Yêu cầu đăng ký gói"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {isEn
                ? "You need an active subscription plan to access Chatbot and Documents."
                : "Bạn cần có gói đăng ký đang hoạt động để truy cập AI Chatbot và Tài liệu."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSubscriptionRequiredModal(false);
                  router.replace(pathname);
                }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {isEn ? "Close" : "Đóng"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubscriptionRequiredModal(false);
                  router.push("/tenant-admin/subscription");
                }}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {isEn ? "Go to Subscription" : "Đi tới Gói đăng ký"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
