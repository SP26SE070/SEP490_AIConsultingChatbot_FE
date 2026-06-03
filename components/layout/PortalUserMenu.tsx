"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { getAccessToken, clearAuth, getStoredUser } from "@/lib/auth-store";
import { getProfile } from "@/lib/api/profile";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { useAppTheme } from "@/lib/use-app-theme";
import {
  getPortalAccent,
  portalAccentStyles,
  type PortalAccent,
} from "@/lib/portal-accent";
import { cn } from "@/lib/utils/cn";
import { portalUserMenuPillClass } from "@/lib/dashboard-ui";

/** Menu user kiểu Tenant Admin (pill rounded-2xl + dropdown). */
export function PortalUserMenu({ accent: accentProp }: { accent?: PortalAccent }) {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguageStore();
  const t = translations[language];
  const { theme, toggleTheme } = useAppTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const accent = accentProp ?? getPortalAccent(getStoredUser()?.roles);
  const ac = portalAccentStyles[accent];

  const fallbackEmail = getStoredUser()?.email ?? "user@company.com";
  const [displayName, setDisplayName] = useState(
    () => fallbackEmail.split("@")[0] || "User"
  );
  const [displayEmail, setDisplayEmail] = useState(fallbackEmail);

  useEffect(() => {
    const email = getStoredUser()?.email ?? fallbackEmail;
    setDisplayEmail(email);
    setDisplayName(email.split("@")[0] || "User");
  }, [fallbackEmail]);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile?.fullName?.trim()) {
          setDisplayName(profile.fullName.trim());
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
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
      // client sign-out still proceeds
    } finally {
      clearAuth();
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <>
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsUserMenuOpen((prev) => !prev)}
          className={portalUserMenuPillClass}
        >
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              ac.avatarGradient
            )}
          >
            <User className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="hidden max-w-[12rem] truncate text-sm font-semibold text-zinc-900 dark:text-white sm:inline">
            {displayName}
          </span>
          <svg
            className={cn(
              "hidden h-4 w-4 text-zinc-400 transition-transform sm:block",
              isUserMenuOpen && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
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
              <div className={cn("border-b px-4 py-3", ac.menuHeaderFull)}>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      ac.avatarGradient
                    )}
                  >
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                      {displayEmail}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button
                  type="button"
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
                  type="button"
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
                  type="button"
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

      {isSettingsOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-4">
            <div
              className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />
            <div className="relative my-auto w-full max-h-[min(90dvh,40rem)] max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {t.settings}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
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
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {t.theme}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {theme === "light" ? t.lightMode : t.darkMode}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      theme === "dark" ? ac.settingsToggle : "bg-zinc-300"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform",
                        theme === "dark" ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-3">
                    <Globe className={cn("h-5 w-5", ac.settingsIcon)} />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {t.language}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {language === "en" ? "English" : "Tiếng Việt"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className={cn(
                      "rounded-xl px-4 py-2 text-xs font-medium text-white transition",
                      ac.settingsLangBtn
                    )}
                  >
                    {language === "en" ? "EN" : "VI"}
                  </button>
                </div>
              </div>
              <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className={cn(
                    "w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg transition",
                    ac.settingsDoneBtn
                  )}
                >
                  {t.done}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
