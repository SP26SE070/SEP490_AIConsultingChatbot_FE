"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, User, LogOut, Settings, Sun, Moon, Globe, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { getAccessToken, clearAuth, getStoredUser } from "@/lib/auth-store";
import { getProfile } from "@/lib/api/profile";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { useAppTheme } from "@/lib/use-app-theme";
import { AppLogo } from "@/components/brand/AppLogo";

const TENANT_FALLBACK_EMAIL = "tenantadmin@company.vn";

interface DashboardHeaderProps {
  title: string;
  onMenuClick: () => void;
  onOpenOnboarding?: () => void;
  onboardingButtonLabel?: string;
  onboardingBadgeLabel?: string | null;
  showOnboardingButton?: boolean;
}

export function DashboardHeader({
  title,
  onMenuClick,
  onOpenOnboarding,
  onboardingButtonLabel,
  onboardingBadgeLabel = null,
  showOnboardingButton = true,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { theme, toggleTheme } = useAppTheme();
  const [displayName, setDisplayName] = useState(
    () => TENANT_FALLBACK_EMAIL.split("@")[0] || "Tenant Admin"
  );
  const [displayEmail, setDisplayEmail] = useState(TENANT_FALLBACK_EMAIL);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const { language, toggleLanguage } = useLanguageStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const t = translations[language];

  useEffect(() => {
    const email = getStoredUser()?.email ?? TENANT_FALLBACK_EMAIL;
    setDisplayEmail(email);
    setDisplayName(email.split("@")[0] || "Tenant Admin");
  }, []);

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
        // Keep fallback from auth store email when profile request fails.
      });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    const token = getAccessToken();
    try {
      if (token) {
        await logout(token);
      }
    } catch {
      // Ignore API/logout transport failures; client-side sign-out still proceeds.
    } finally {
      clearAuth();
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-16 min-w-0 items-center justify-between gap-2 px-0 py-1 sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          className="rounded-2xl bg-white p-2.5 text-zinc-700 shadow-sm shadow-zinc-200/70 dark:bg-zinc-950 dark:text-zinc-400 dark:shadow-black/20 sm:p-3.5 lg:hidden"
          onClick={onMenuClick}
        >
          <span className="sr-only">{t.openSidebar}</span>
          <Menu className="h-5 w-5" />
        </button>

        <Link
          href="/tenant-admin"
          className="flex h-11 min-w-0 max-w-[9.5rem] items-center gap-2 px-1 transition hover:text-emerald-600 sm:max-w-56 dark:hover:text-emerald-400"
        >
          <AppLogo
            size={32}
            tenantLogoUrl={tenantLogoUrl}
            tenantName={tenantName}
            className="shrink-0"
          />
          <div className="min-w-0 leading-tight">
            <p className="hidden truncate text-xs font-medium text-zinc-500 sm:block dark:text-zinc-400">
              Internal Consultant AI
            </p>
            <p className="truncate text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-100">
              {title}
            </p>
          </div>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
        {showOnboardingButton ? (
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="group hidden items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-emerald-600 hover:bg-emerald-600 hover:text-white sm:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-emerald-500 dark:hover:bg-emerald-600"
          >
            <Sparkles className="h-4.5 w-4.5" />
            <span>{onboardingButtonLabel ?? t.onboarding}</span>
            {onboardingBadgeLabel ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-bold text-zinc-700 transition group-hover:bg-white/20 group-hover:text-white dark:bg-zinc-700/90 dark:text-zinc-100">
                {onboardingBadgeLabel}
              </span>
            ) : null}
          </button>
        ) : null}

        {/* User Menu Dropdown */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 rounded-2xl bg-white px-2.5 py-2 shadow-sm shadow-zinc-200/70 transition hover:bg-zinc-50 sm:px-3.5 sm:py-2.5 dark:bg-zinc-950 dark:shadow-black/20 dark:hover:bg-zinc-900"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-emerald-600">
              <User className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="hidden text-sm font-semibold text-zinc-900 dark:text-white xl:block">
              {displayName}
            </span>
            <svg
              className={`hidden h-4 w-4 text-zinc-400 transition-transform xl:block ${
                isUserMenuOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* User Info */}
                <div className="border-b border-zinc-200 bg-linear-to-br from-emerald-50 to-white px-4 py-3 dark:border-zinc-800 dark:from-emerald-950/20 dark:to-zinc-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-emerald-600">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{displayName}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{displayEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  <button
                    onClick={() => {
                      router.push("/profile");
                      setIsUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <User className="h-4 w-4" />
                    <span>{t.profile}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Settings className="h-4 w-4" />
                    <span>{t.settings}</span>
                  </button>

                  <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-800" />

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t.logout}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Settings modal: portal to body so `fixed` is not clipped by sticky header `backdrop-blur` */}
      {isSettingsOpen &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-4">
          <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative my-auto w-full max-w-md max-h-[min(90dvh,40rem)] overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            {/* Header */}
            <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{t.settings}</h3>
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

            {/* Content */}
            <div className="space-y-4 p-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  {theme === 'light' ? (
                    <Sun className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-blue-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{t.theme}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {theme === 'light' ? t.lightMode : t.darkMode}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    theme === 'dark' ? 'bg-emerald-500' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                      theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Language Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{t.language}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {language === 'en' ? 'English' : 'Tiếng Việt'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleLanguage}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-600"
                >
                  {language === 'en' ? 'EN' : 'VI'}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600"
              >
                {t.done}
              </button>
            </div>
          </div>
        </div>,
        document.body
        )}
    </div>
  );
}
