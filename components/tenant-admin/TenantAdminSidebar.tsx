"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Users,
  Building,
  Shield,
  Bot,
  FileText,
  BarChart3,
  CreditCard,
  ClipboardList,
  Sparkles,
  X,
} from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getMySubscription, type MySubscriptionResponse } from "@/lib/api/subscription";
import {
  SIDEBAR_SUBSCRIPTION_CACHE_TTL_MS,
  TENANT_SUBSCRIPTION_UPDATED_EVENT,
  readSidebarSubscriptionCache,
  writeSidebarSubscriptionCache,
  type TenantSubscriptionUpdatedDetail,
} from "@/lib/subscription-sync";
import { getStoredUser } from "@/lib/auth-store";

interface TenantAdminSidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function TenantAdminSidebar({ open, setOpen }: TenantAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguageStore();
  const t = translations[language];
  const [bootState] = useState(() => {
    const tenantId = getStoredUser()?.tenantId ?? null;
    const cache = readSidebarSubscriptionCache(tenantId);
    return { tenantId, cache };
  });
  const tenantId = bootState.tenantId;
  const initialSubscriptionCache = bootState.cache;
  const [subscription, setSubscription] = useState<MySubscriptionResponse | null>(
    () => initialSubscriptionCache?.data ?? null
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(
    () => !initialSubscriptionCache
  );
  
  const navigation = [
    { name: t.dashboard, href: "/tenant-admin", icon: LayoutDashboard },
    { name: t.employees, href: "/tenant-admin/employees", icon: Users },
    { name: t.departments, href: "/tenant-admin/departments", icon: Building },
    { name: t.roles, href: "/tenant-admin/roles", icon: Shield },
    { name: t.documents, href: "/tenant-admin/documents", icon: FileText },
    { name: t.aiChatbot, href: "/chatbot", icon: Bot },
    { name: t.analytics, href: "/tenant-admin/analytics", icon: BarChart3 },
    { name: t.aiInsights, href: "/tenant-admin/ai-insights", icon: Sparkles },
    { name: t.auditLogs, href: "/tenant-admin/audit-logs", icon: ClipboardList },
    { name: t.subscription, href: "/tenant-admin/subscription", icon: CreditCard },
  ];

  useEffect(() => {
    let mounted = true;
    const cacheIsFresh =
      !!initialSubscriptionCache &&
      Date.now() - initialSubscriptionCache.fetchedAt <=
        SIDEBAR_SUBSCRIPTION_CACHE_TTL_MS;

    if (cacheIsFresh) {
      return () => {
        mounted = false;
      };
    }

    getMySubscription()
      .then((data) => {
        if (!mounted) return;
        setSubscription(data);
        writeSidebarSubscriptionCache(tenantId, data);
      })
      .catch(() => {
        if (!mounted) return;
        if (!initialSubscriptionCache) {
          setSubscription(null);
          writeSidebarSubscriptionCache(tenantId, null);
        }
      })
      .finally(() => {
        if (!mounted) return;
        setSubscriptionLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [initialSubscriptionCache, tenantId]);

  useEffect(() => {
    const handleSubscriptionUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<TenantSubscriptionUpdatedDetail>;
      const detail = customEvent.detail;
      if (!detail) return;
      if (detail.tenantId !== tenantId) return;
      setSubscription(detail.subscription);
      setSubscriptionLoading(false);
    };

    window.addEventListener(
      TENANT_SUBSCRIPTION_UPDATED_EVENT,
      handleSubscriptionUpdated as EventListener
    );

    return () => {
      window.removeEventListener(
        TENANT_SUBSCRIPTION_UPDATED_EVENT,
        handleSubscriptionUpdated as EventListener
      );
    };
  }, [tenantId]);

  useEffect(() => {
    router.prefetch("/tenant-admin/documents");
  }, [router]);

  const tierVi: Record<string, string> = {
    TRIAL: "Dùng thử",
    STARTER: "Khởi đầu",
    STANDARD: "Tiêu chuẩn",
    ENTERPRISE: "Doanh nghiệp",
  };
  const tierEn: Record<string, string> = {
    TRIAL: "Trial",
    STARTER: "Starter",
    STANDARD: "Standard",
    ENTERPRISE: "Enterprise",
  };
  const tierLabel = subscription
    ? language === "en"
      ? tierEn[subscription.tier] ?? subscription.tier
      : tierVi[subscription.tier] ?? subscription.tier
    : "—";
  const usersLabel =
    subscriptionLoading || !subscription
      ? "—"
      : `${subscription.maxUsers ?? "—"}`;
  const storageLabel =
    subscriptionLoading || !subscription
      ? "—"
      : `${subscription.maxStorageGb ?? "—"} GB`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/80 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-80 flex h-dvh w-64 shrink-0 flex-col overflow-hidden border-r-2 border-zinc-200/90 bg-white shadow-2xl shadow-purple-100/50 transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/45 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col p-6">
          <div className="shrink-0 space-y-4">
            <div className="flex items-start justify-end">
              <button
                onClick={() => setOpen(false)}
                className="mt-1 lg:hidden"
              >
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>

            <div className="px-0.5 py-1">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                {t.management}
              </p>
            </div>
          </div>

          <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2 text-sm [scrollbar-gutter:stable]">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => {
                    setOpen(false);
                  }}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                  className={cn(
                    "relative flex w-full items-center justify-between overflow-hidden rounded-2xl px-3.5 py-3 font-medium transition",
                    isActive
                      ? "text-white shadow-sm shadow-purple-400/60"
                      : "text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="tenant-sidebar-active-pill"
                      className="absolute inset-0 rounded-2xl bg-purple-500"
                      transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.9 }}
                    />
                  ) : null}
                  <span className="relative z-10 flex items-center gap-3">
                    <span className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-2xl text-sm",
                      isActive ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-900"
                    )}>
                      <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-zinc-500")} />
                    </span>
                    {item.name}
                  </span>
                  {isActive && <span className="relative z-10 h-8 w-1.5 rounded-full bg-white/70" />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 shrink-0">
            <div className="space-y-3 rounded-2xl bg-linear-to-br from-purple-50 to-violet-50 p-4 text-xs dark:from-purple-950/30 dark:to-violet-950/30">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {t.currentPlan}
                </p>
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400">
                  {subscriptionLoading ? "…" : subscription?.status ?? "—"}
                </span>
              </div>
              <div className="space-y-2 text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>{t.plan}</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {tierLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.usersLabel}</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {usersLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.storage}</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {storageLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
