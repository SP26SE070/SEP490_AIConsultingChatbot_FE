"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { DashboardAnimatedBackground } from "@/components/ui/DashboardAnimatedBackground";
import type { PortalAccent } from "@/lib/portal-accent";

export interface DashboardPortalShellProps {
  /** Route trang chủ dashboard, ví dụ `/staff` (giữ cho tương lai nếu cần highlight tab) */
  dashboardHomePath: string;
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
  accent?: PortalAccent;
}

export function DashboardPortalShell({
  sidebar,
  header,
  children,
  accent = "blue",
}: DashboardPortalShellProps) {
  const pathname = usePathname();

  return (
    <div className="dashboard-portal-shell flex h-dvh max-h-dvh w-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent dark:bg-zinc-950">
      <header className="fixed top-0 right-0 left-0 z-50 flex h-16 min-w-0 items-center border-b border-zinc-200/90 bg-white/95 px-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/95 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)] sm:px-5 lg:pl-64 lg:pr-8">
        <span
          className="pointer-events-none absolute bottom-0 left-64 top-0 hidden w-px bg-zinc-200/90 lg:block dark:bg-zinc-800/90"
          aria-hidden
        />
        {header}
      </header>

      <div className="scrollbar-chat-hidden relative flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pt-16 pb-4 sm:px-5 sm:pb-5 lg:pl-0 lg:pr-8 lg:pb-6">
        {sidebar}

        <main
          data-dashboard-animated="true"
          className="relative min-h-full min-w-0 flex-1 overflow-x-hidden bg-transparent px-0 py-2 sm:px-3 lg:border-l lg:border-zinc-200/90 lg:px-4 lg:pl-72 dark:lg:border-zinc-800/90 xl:pl-72"
        >
          <div className="pointer-events-none fixed inset-x-0 bottom-0 top-16 z-0 lg:left-64">
            <DashboardAnimatedBackground accent={accent} />
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
  );
}
