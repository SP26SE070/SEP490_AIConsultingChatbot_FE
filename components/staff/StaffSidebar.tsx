"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  X,
  Package,
  GraduationCap,
} from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { StaffPortalCard } from "@/components/staff/StaffPortalCard";

interface StaffSidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function StaffSidebar({ open, setOpen }: StaffSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguageStore();
  const t = translations[language];

  const navigation = [
    { name: t.dashboard, href: "/staff", icon: LayoutDashboard },
    { name: t.organizations, href: "/staff/organizations", icon: Building2 },
    { name: "Onboarding", href: "/staff/onboarding", icon: GraduationCap },
    { name: "Subscriptions", href: "/staff/subscriptions", icon: Package },
    { name: "Transactions", href: "/staff/transactions", icon: CreditCard },
  ];

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
          "fixed inset-y-0 left-0 z-80 flex h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-zinc-200/90 bg-white shadow-xl shadow-zinc-200/40 transition-transform duration-300 dark:border-zinc-800/90 dark:bg-zinc-950 dark:shadow-none lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col p-6">
          <div className="shrink-0 space-y-4">
            <div className="flex items-start justify-end lg:min-h-0">
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
                      layoutId="staff-sidebar-active-pill"
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
            <StaffPortalCard />
          </div>
        </div>
      </aside>
    </>
  );
}
