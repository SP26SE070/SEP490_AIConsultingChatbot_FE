"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLogo } from "@/components/brand/AppLogo";
import { PortalUserMenu } from "@/components/layout/PortalUserMenu";
import { getStoredUser } from "@/lib/auth-store";
import { roleToPath } from "@/lib/auth-routes";
import { getProfile } from "@/lib/api/profile";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getPortalAccent, type PortalAccent } from "@/lib/portal-accent";

function portalTitle(roles: string[] | undefined, t: (typeof translations)["en"]) {
  if (roles?.some((r) => r.includes("ROLE_STAFF"))) return t.staff;
  if (roles?.some((r) => r.includes("ROLE_SUPER_ADMIN"))) return t.superAdmin;
  if (roles?.some((r) => r.includes("ROLE_TENANT_ADMIN"))) return t.tenantAdmin;
  return "Employee";
}

export function ProfileAppHeader() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [accent, setAccent] = useState<PortalAccent>("emerald");
  const [homeHref, setHomeHref] = useState("/employee");
  const [title, setTitle] = useState(t.tenantAdmin);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    const roles = user?.roles;
    setAccent(getPortalAccent(roles));
    setHomeHref(roleToPath(roles ?? []));
    setTitle(portalTitle(roles, t));
  }, [t]);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        setTenantLogoUrl(profile?.tenantLogoUrl ?? null);
        setTenantName(profile?.tenantName ?? null);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-zinc-200/90 bg-white/95 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/95 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="flex h-16 w-full min-w-0 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-5 lg:px-8">
        <Link
          href={homeHref}
          className="flex h-11 min-w-0 max-w-[10.5rem] items-center gap-3.5 pl-2 transition hover:text-emerald-600 sm:max-w-60 sm:gap-4 sm:pl-3 dark:hover:text-emerald-400"
        >
          <AppLogo
            size={32}
            tenantLogoUrl={tenantLogoUrl}
            tenantName={tenantName}
            className="shrink-0"
          />
          <div className="min-w-0 pl-0.5 leading-tight sm:pl-1">
            <p className="hidden truncate text-xs font-medium text-zinc-500 sm:block dark:text-zinc-400">
              Internal Consultant AI
            </p>
            <p className="truncate text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-100">
              {title}
            </p>
          </div>
        </Link>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <PortalUserMenu accent={accent} />
        </div>
      </div>
    </header>
  );
}
