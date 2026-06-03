"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { isAuthenticated } from "@/lib/auth-store";
import {
  fetchPlatformDashboard,
  parsePlatformDashboardJson,
} from "@/lib/api/platform-dashboard";
import { STAFF_PORTAL_STATS_REFRESH_EVENT } from "@/lib/staff-portal-stats-refresh";

const POLL_MS = 1200;

function AnimatedStat({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }
  return (
    <motion.span
      key={value}
      className="inline-block min-w-[1.25rem] text-right tabular-nums"
      initial={{ opacity: 0.45, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.6 }}
    >
      {value}
    </motion.span>
  );
}

export function StaffPortalCard() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [mounted, setMounted] = useState(false);
  const [orgTotal, setOrgTotal] = useState<number | null>(null);
  const [orgPending, setOrgPending] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    const { ok, data } = await fetchPlatformDashboard(true);
    if (!ok) return;
    const parsed = parsePlatformDashboardJson(true, data);
    setOrgTotal(parsed.tenants.total);
    setOrgPending(parsed.tenants.pending);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    void load();
    const intervalId = window.setInterval(() => void load(), POLL_MS);

    const onRefresh = () => void load();
    window.addEventListener(STAFF_PORTAL_STATS_REFRESH_EVENT, onRefresh);

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(STAFF_PORTAL_STATS_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mounted, load]);

  return (
    <div className="space-y-3 rounded-2xl bg-linear-to-br from-purple-50 to-violet-50 p-4 text-xs dark:from-purple-950/30 dark:to-violet-950/30">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-zinc-800 dark:text-zinc-100">Staff Portal</p>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400">
          {t.active}
        </span>
      </div>
      <div className="space-y-2 text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink">{t.totalTenants}</span>
          <span className="font-semibold text-zinc-900 dark:text-white">
            <AnimatedStat value={orgTotal} />
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink">{t.pending}</span>
          <span className="font-semibold text-zinc-900 dark:text-white">
            <AnimatedStat value={orgPending} />
          </span>
        </div>
      </div>
    </div>
  );
}
