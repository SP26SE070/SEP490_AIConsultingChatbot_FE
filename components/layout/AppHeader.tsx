"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { logout } from "@/lib/api/auth";
import { getAccessToken, getStoredUser, clearAuth } from "@/lib/auth-store";
import { getProfile } from "@/lib/api/profile";
import { roleToPath, hasAllowedRole } from "@/lib/auth-routes";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { useAppTheme } from "@/lib/use-app-theme";
import { AppLogo } from "@/components/brand/AppLogo";
import { getPortalAccent, portalAccentStyles } from "@/lib/portal-accent";
import { cn } from "@/lib/utils/cn";

const ROLE_EMPLOYEE = "ROLE_EMPLOYEE";
const ROLE_TENANT_ADMIN = "ROLE_TENANT_ADMIN";
const ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";
const ROLE_STAFF = "ROLE_STAFF";

const navLinks = [
  { href: "/employee", label: "Employee", roles: [ROLE_EMPLOYEE] },
  { href: "/tenant-admin", label: "Tenant Admin", roles: [ROLE_TENANT_ADMIN] },
  { href: "/super-admin", label: "Super Admin", roles: [ROLE_SUPER_ADMIN] },
  { href: "/staff", label: "Staff", roles: [ROLE_STAFF] },
];

/** Same nav on server + first client paint as after hydration (avoids getStoredUser() SSR/client mismatch). */
function homeHrefFromPathname(pathname: string): string {
  if (pathname.startsWith("/staff")) return "/staff";
  if (pathname.startsWith("/super-admin")) return "/super-admin";
  if (pathname.startsWith("/tenant-admin")) return "/tenant-admin";
  if (pathname.startsWith("/employee")) return "/employee";
  return "/employee";
}

function navLinksMatchingPath(pathname: string) {
  return navLinks.filter(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`)
  );
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { language, toggleLanguage } = useLanguageStore();
  const t = translations[language];
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const user = mounted ? getStoredUser() : null;
  const roles = user?.roles ?? [];
  const allowedLinks = mounted
    ? navLinks.filter((link) => hasAllowedRole(roles, link.roles, link.href))
    : navLinksMatchingPath(pathname);
  const homeHref =
    mounted && roles.length > 0 ? roleToPath(roles) : homeHrefFromPathname(pathname);
  const displayEmail = user?.email ?? "user@company.com";
  const [displayName, setDisplayName] = useState(displayEmail.split("@")[0] || "User");
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const { theme, toggleTheme } = useAppTheme();
  const accent = mounted ? getPortalAccent(roles) : "emerald";
  const ac = portalAccentStyles[accent];

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile?.fullName?.trim()) {
          setDisplayName(profile.fullName.trim());
        }
        setTenantLogoUrl(profile?.tenantLogoUrl ?? null);
        setTenantName(profile?.tenantName ?? null);
      })
      .catch(() => {
        // keep fallback name from email
      });
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setIsUserMenuOpen(false);
    };
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", onMouseDown);
    }
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    const token = getAccessToken();
    try {
      if (token) await logout(token);
    } catch {
      // Ignore API/logout transport failures; client-side sign-out still proceeds.
    } finally {
      clearAuth();
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-zinc-200/90 bg-white/95 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/95 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="flex h-14 w-full min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-7">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-2.5 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            <AppLogo
              size={28}
              tenantLogoUrl={tenantLogoUrl}
              tenantName={tenantName}
              className="shrink-0"
            />
          </Link>
          <nav className="hidden items-center gap-1.5 md:flex">
            {allowedLinks.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-sm font-medium leading-none transition",
                    isActive ? ac.navActive : cn("rounded-full border px-4 py-1.5", ac.navInactive)
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="relative flex shrink-0 items-center gap-2" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 shadow-sm transition sm:px-3",
              theme === "dark"
                ? cn("bg-zinc-950/90 text-white", ac.headerUserBorder, ac.headerUserBg)
                : cn("bg-white text-zinc-900", ac.headerUserBorder, ac.headerUserBg)
            )}
          >
            <div className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-white", ac.headerAvatar)}>
              <User className="h-4 w-4 text-white" />
            </div>
            <span className={`hidden max-w-36 truncate text-xs font-semibold sm:inline ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>{displayName}</span>
            <svg
              className={`hidden h-4 w-4 transition-transform sm:block ${theme === "dark" ? "text-zinc-300" : "text-zinc-500"} ${isUserMenuOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className={cn("border-b border-zinc-200 bg-linear-to-br to-white px-4 py-3 dark:border-zinc-800 dark:to-zinc-900", ac.menuHeader)}>
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", ac.avatarGradient)}>
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{displayName}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{displayEmail}</p>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push("/profile");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Settings</h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  {theme === "light" ? (
                    <Sun className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-blue-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{t.theme}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{theme === "light" ? t.lightMode : t.darkMode}</p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    theme === "dark" ? "bg-emerald-500" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                      theme === "dark" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{t.language}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{language === "en" ? "English" : "Tiếng Việt"}</p>
                  </div>
                </div>
                <button
                  onClick={toggleLanguage}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-600"
                >
                  {language === "en" ? "EN" : "VI"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
