"use client";

import { useEffect, useState } from "react";
import { OrganizationStats } from "@/components/tenant-admin/OrganizationStats";
import { AIUsageChart } from "@/components/tenant-admin/AIUsageChart";
import { EmployeeOverview } from "@/components/tenant-admin/EmployeeOverview";
import { DepartmentOverview } from "@/components/tenant-admin/DepartmentOverview";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getTenantLlmUsage, type TenantLlmUsageResponse } from "@/lib/api/tenant-admin";
import { isAuthExpiredErrorMessage } from "@/lib/auth-session-events";
export default function TenantAdminPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [llmUsage, setLlmUsage] = useState<TenantLlmUsageResponse | null>(null);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmError, setLlmError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTenantLlmUsage()
      .then((data) => {
        if (cancelled) return;
        setLlmUsage(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setLlmUsage(null);
        const message = e instanceof Error ? e.message : "Failed to load AI usage";
        setLlmError(isAuthExpiredErrorMessage(message) ? null : message);
      })
      .finally(() => {
        if (!cancelled) setLlmLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
      <div className="dashboard-page-shell space-y-10">
        {/* Header */}
        <div className="pt-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            {t.organizationDashboard}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {t.manageEmployeesStructure}
          </p>
        </div>

        {/* Charts: organization KPIs */}
        <OrganizationStats />

        {/* Charts: people & departments */}
        <div className="mt-2 grid gap-6 lg:grid-cols-2 lg:mt-4">
          <EmployeeOverview />
          <DepartmentOverview />
        </div>

        {/* AI usage */}
        <AIUsageChart data={llmUsage} loading={llmLoading} error={llmError} />
      </div>
  );
}

