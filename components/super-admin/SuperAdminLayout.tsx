"use client";

import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { useState } from "react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { DashboardPortalShell } from "@/components/layout/DashboardPortalShell";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language } = useLanguageStore();
  const t = translations[language];

  return (
    <DashboardPortalShell
      dashboardHomePath="/super-admin"
      accent="blue"
      sidebar={<SuperAdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />}
      header={
        <DashboardHeader
          title={t.superAdmin}
          onMenuClick={() => setSidebarOpen(true)}
        />
      }
    >
      {children}
    </DashboardPortalShell>
  );
}
