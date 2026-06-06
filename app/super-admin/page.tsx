"use client";

import { PlatformStats } from "@/components/super-admin/PlatformStats";
import { RecentActivity } from "@/components/super-admin/RecentActivity";
import { AIQueriesChart } from "@/components/super-admin/AIQueriesChart";
import { PlatformSubscriptionsChart } from "@/components/super-admin/PlatformSubscriptionsChart";
import { KnowledgeVolumeChart } from "@/components/super-admin/KnowledgeVolumeChart";
import { AdminRevenueChart } from "@/components/super-admin/AdminRevenueChart";
import { TenantStatusBreakdown } from "@/components/super-admin/TenantStatusBreakdown";
import { SystemHealth } from "@/components/super-admin/SystemHealth";
import { SuperAdminDashboardAnalyticsProvider } from "@/components/super-admin/SuperAdminDashboardAnalyticsContext";
import { useLanguageStore } from "@/lib/language-store";

export default function SuperAdminDashboard() {
  const { language } = useLanguageStore();
  const isEn = language === "en";

  return (
    <SuperAdminDashboardAnalyticsProvider>
      <div className="dashboard-page-shell space-y-10">
        <div className="pt-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            {isEn ? "Platform Dashboard" : "Bảng điều khiển nền tảng"}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {isEn ? "Manage and monitor the entire platform" : "Quản lý và giám sát toàn bộ nền tảng"}
          </p>
        </div>

        {/* People: chỉ KPI không trùng biểu đồ */}
        <PlatformStats />

        {/* Doanh thu — placeholder + note BE */}
        <AdminRevenueChart />

        {/* LLM + Subscription (tách khỏi tài liệu / chunk) */}
        <div className="mt-2 grid gap-8 lg:grid-cols-2 lg:mt-4">
          <AIQueriesChart />
          <PlatformSubscriptionsChart />
        </div>
        <div className="mt-2 grid gap-6 lg:grid-cols-2 lg:mt-4">
          <KnowledgeVolumeChart />

          {/* Một card tenant (status + tỷ lệ cùng layout) */}
          <TenantStatusBreakdown
            header="users"
            title={isEn ? "Tenant overview" : "Tổ chức — tổng quan"}
            subtitle={
              isEn
                ? "Counts and share by lifecycle status"
                : "Số lượng và tỷ lệ theo trạng thái vòng đời"
            }
          />
        </div>

        <div className="mt-2 grid gap-6 lg:grid-cols-2 lg:mt-4">
          <SystemHealth />
          <RecentActivity />
        </div>
      </div>
    </SuperAdminDashboardAnalyticsProvider>
  );
}
