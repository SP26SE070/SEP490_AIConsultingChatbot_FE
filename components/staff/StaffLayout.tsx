"use client";

import { useState } from "react";
import { StaffSidebar } from "./StaffSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardPortalShell } from "@/components/layout/DashboardPortalShell";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";

interface StaffLayoutProps {
  children: React.ReactNode;
}

export function StaffLayout({ children }: StaffLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language } = useLanguageStore();
  const t = translations[language];

  return (
    <DashboardPortalShell
      dashboardHomePath="/staff"
      accent="blue"
      sidebar={<StaffSidebar open={sidebarOpen} setOpen={setSidebarOpen} />}
      header={
        <DashboardHeader
          title={t.staff}
          onMenuClick={() => setSidebarOpen(true)}
        />
      }
    >
      {children}
    </DashboardPortalShell>
  );
}
