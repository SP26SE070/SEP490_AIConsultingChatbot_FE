"use client";

import { TenantSettings } from "@/components/tenant-admin/TenantSettings";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";

export default function TenantSettingsPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {isEn ? "Organization Settings" : "Cài đặt tổ chức"}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {isEn
            ? "Manage your organization information and branding"
            : "Quản lý thông tin và nhận diện thương hiệu của tổ chức"}
        </p>
      </div>

      {/* Settings Component */}
      <TenantSettings />
    </div>
  );
}
