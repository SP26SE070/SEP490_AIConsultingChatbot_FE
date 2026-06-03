"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Shield,
  X,
  Users,
  CreditCard,
  ChartBar,
} from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getStoredUser } from "@/lib/auth-store";
import {
  fetchPlatformDashboard,
  parsePlatformDashboardJson,
  staffActiveOrganizationsCount,
  type SystemStatusUi,
} from "@/lib/api/platform-dashboard";

type SidebarSystemStatus = {
  systemStatus: SystemStatusUi;
  systemStatusLabelRaw: string;
  activeOrgs: number;
  adminPlatformUsers: number;
};

const DEFAULT_STATUS: SidebarSystemStatus = {
  systemStatus: "Unknown",
  systemStatusLabelRaw: "",
  activeOrgs: 0,
  adminPlatformUsers: 0,
};

type SuperAdminSidebarProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function SuperAdminSidebar({ open, setOpen }: SuperAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguageStore();
  const t = translations[language];
  const [statusData, setStatusData] = useState<SidebarSystemStatus>(DEFAULT_STATUS);
  /** Tránh hydration mismatch: server không có localStorage → luôn false đến khi mount. */
  const [mounted, setMounted] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    const roles = getStoredUser()?.roles ?? [];
    setIsSuperAdmin(roles.some((role) => role.includes("SUPER_ADMIN")));
    setIsStaff(roles.some((role) => role.includes("STAFF")));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isSuperAdmin) return;

    let cancelled = false;

    const fetchDashboardStatus = async () => {
      try {
        const { ok, data } = await fetchPlatformDashboard(isStaff);
        if (!ok) throw new Error("Failed to load dashboard status");
        const parsed = parsePlatformDashboardJson(isStaff, data);

        if (!cancelled) {
          setStatusData({
            systemStatus: parsed.systemStatus,
            systemStatusLabelRaw: parsed.systemStatusLabelRaw,
            activeOrgs: staffActiveOrganizationsCount(parsed),
            adminPlatformUsers: parsed.adminPlatformUsers,
          });
        }
      } catch {
        if (!cancelled) {
          setStatusData(DEFAULT_STATUS);
        }
      }
    };

    const handleInstantSync = () => {
      if (document.visibilityState === "visible" && window.location.pathname.startsWith("/super-admin")) {
        void fetchDashboardStatus();
      }
    };

    void fetchDashboardStatus();
    const intervalId = window.setInterval(() => {
      void fetchDashboardStatus();
    }, 1200);
    document.addEventListener("visibilitychange", handleInstantSync);
    window.addEventListener("focus", handleInstantSync);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleInstantSync);
      window.removeEventListener("focus", handleInstantSync);
    };
  }, [mounted, isSuperAdmin, isStaff]);

  if (!mounted || !isSuperAdmin) return null;

  /** Không dùng raw API (có thể luôn tiếng Việt); ưu tiên nhãn theo ngôn ngữ. */
  const statusLabel =
    statusData.systemStatus === "Healthy"
      ? t.healthy
      : statusData.systemStatus === "Unhealthy"
        ? t.unhealthy
        : statusData.systemStatusLabelRaw.trim() || t.unknown;

  const statusDotClass =
    statusData.systemStatus === "Healthy"
      ? "bg-lime-400"
      : statusData.systemStatus === "Unhealthy"
        ? "bg-red-500"
        : "bg-zinc-400";
  
  const navigation = [
    { name: t.dashboard, href: "/super-admin", icon: LayoutDashboard },
    { name: t.roles, href: "/super-admin/roles", icon: Shield },
    { name: t.staff, href: "/super-admin/staff", icon: Users },
    { name: t.pricing, href: "/super-admin/pricing", icon: CreditCard },
    { name: t.subscriptions, href: "/super-admin/subscriptions", icon: CreditCard },
    { name: t.aiInsights, href: "/super-admin/ai-insights", icon: ChartBar },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/80 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-80 flex h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-zinc-200/90 bg-white shadow-xl shadow-zinc-200/40 transition-transform duration-300 dark:border-zinc-800/90 dark:bg-zinc-950 dark:shadow-none lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col p-6">
          <div className="shrink-0 space-y-4">
            <div className="flex items-start justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-1 lg:hidden"
              >
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>

            <div className="px-0.5 py-1">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                {t.platformMenu}
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
                  onClick={() => setOpen(false)}
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
                      layoutId="super-admin-sidebar-active-pill"
                      className="absolute inset-0 rounded-2xl bg-purple-500"
                      transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.9 }}
                    />
                  ) : null}
                  <span className="relative z-10 flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-2xl text-sm",
                        isActive ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-900"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4",
                          isActive ? "text-white" : "text-zinc-500"
                        )}
                      />
                    </span>
                    {item.name}
                  </span>
                  {isActive ? (
                    <span className="relative z-10 h-8 w-1.5 rounded-full bg-white/70" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 shrink-0">
            <div className="space-y-3 rounded-2xl bg-linear-to-br from-purple-50 to-violet-50 p-4 text-xs dark:from-purple-950/30 dark:to-violet-950/30">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {t.systemStatus}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-400">
                  <span className={cn("h-2 w-2 rounded-full", statusDotClass)} />
                  {statusLabel}
                </span>
              </div>
              <div className="space-y-2 text-zinc-600 dark:text-zinc-400">
                {isStaff ? (
                  <div className="flex items-center justify-between">
                    <span>{t.activeOrganizations}</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {statusData.activeOrgs.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span>{t.platformTotalUsers}</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {statusData.adminPlatformUsers.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
