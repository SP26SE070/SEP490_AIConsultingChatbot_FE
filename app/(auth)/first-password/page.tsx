"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, ShieldCheck, Check, X, Globe, Moon, Sun } from "lucide-react";
import { changePassword } from "@/lib/api/profile";
import { getStoredUser } from "@/lib/auth-store";
import { useLanguageStore } from "@/lib/language-store";
import { useAppTheme } from "@/lib/use-app-theme";
import { translations } from "@/lib/translations";

const t = translations.en;
const tVi = translations.vi;

export default function FirstPasswordPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguageStore();
  const { theme, toggleTheme } = useAppTheme();
  const t = language === "vi" ? tVi : translations.en;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const passwordRequirements = [
    { test: (p: string) => p.length >= 8, label: language === "vi" ? "Ít nhất 8 ký tự" : "At least 8 characters" },
    { test: (p: string) => /[A-Z]/.test(p), label: language === "vi" ? "Ít nhất 1 chữ hoa" : "At least 1 uppercase letter" },
    { test: (p: string) => /[a-z]/.test(p), label: language === "vi" ? "Ít nhất 1 chữ thường" : "At least 1 lowercase letter" },
    { test: (p: string) => /\d/.test(p), label: language === "vi" ? "Ít nhất 1 số" : "At least 1 number" },
    { test: (p: string) => /[@$!%*?&#^]/.test(p), label: language === "vi" ? "Ít nhất 1 ký tự đặc biệt (@$!%*?&#^)" : "At least 1 special character (@$!%*?&#^)" },
  ];

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!newPassword) {
      errors.newPassword = language === "vi" ? "Vui lòng nhập mật khẩu mới." : "Please enter a new password.";
    } else {
      for (const req of passwordRequirements) {
        if (!req.test(newPassword)) {
          errors.newPassword = language === "vi"
            ? "Mật khẩu không đáp ứng yêu cầu."
            : "Password does not meet requirements.";
          break;
        }
      }
    }
    if (!confirmPassword) {
      errors.confirmPassword = language === "vi" ? "Vui lòng xác nhận mật khẩu." : "Please confirm your password.";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = language === "vi"
        ? "Mật khẩu xác nhận không khớp."
        : "Passwords do not match.";
    }
    return errors;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await changePassword({ newPassword });
      setSuccess(true);
      setTimeout(() => {
        const user = getStoredUser();
        if (user?.roles?.includes("ROLE_TENANT_ADMIN")) {
          router.replace("/tenant-admin");
        } else if (user?.roles?.includes("ROLE_SUPER_ADMIN")) {
          router.replace("/super-admin");
        } else if (user?.roles?.includes("ROLE_STAFF")) {
          router.replace("/staff");
        } else {
          router.replace("/employee");
        }
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : (language === "vi" ? "Đổi mật khẩu thất bại." : "Failed to change password.")
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-white/80 px-4 py-3 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:ring-2 dark:bg-zinc-800/80 dark:text-zinc-50 ${
      fieldErrors[field]
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/25"
        : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700"
    }`;

  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-zinc-50 to-emerald-50 dark:from-zinc-950 dark:to-zinc-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-br from-zinc-50 to-emerald-50 dark:from-zinc-950 dark:to-zinc-900">
      {/* Top Right Controls */}
      <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
        <button
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300/50 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <Globe className="h-3.5 w-3.5" />
          {language === "vi" ? "EN" : "VI"}
        </button>
        <button
          onClick={toggleTheme}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300/50 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
              <ShieldCheck className="h-9 w-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {language === "vi" ? "Đặt mật khẩu mới" : "Set New Password"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {language === "vi"
                ? "Vui lòng tạo mật khẩu mới cho tài khoản của bạn."
                : "Please create a new password for your account."}
            </p>
          </div>

          {/* Success State */}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-center shadow-lg backdrop-blur-sm dark:border-emerald-800 dark:bg-emerald-950/50">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
                <Check className="h-6 w-6 text-white" />
              </div>
              <h2 className="mb-1 text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                {language === "vi" ? "Thành công!" : "Success!"}
              </h2>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {language === "vi"
                  ? "Mật khẩu đã được thay đổi. Đang chuyển hướng..."
                  : "Password changed successfully. Redirecting..."}
              </p>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                  <X className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* New Password */}
              <div className="mb-4">
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <Lock className="h-4 w-4" />
                  {language === "vi" ? "Mật khẩu mới" : "New Password"}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass("newPassword")}
                    placeholder={language === "vi" ? "Nhập mật khẩu mới" : "Enter new password"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.newPassword && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                    <X className="h-3 w-3" />
                    {fieldErrors.newPassword}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="mb-5">
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <Lock className="h-4 w-4" />
                  {language === "vi" ? "Xác nhận mật khẩu" : "Confirm Password"}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass("confirmPassword")}
                    placeholder={language === "vi" ? "Nhập lại mật khẩu mới" : "Re-enter new password"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                    <X className="h-3 w-3" />
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="mb-6 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {language === "vi" ? "Yêu cầu mật khẩu:" : "Password requirements:"}
                </p>
                <ul className="space-y-1">
                  {passwordRequirements.map((req, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2 text-xs ${
                        newPassword && req.test(newPassword)
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {newPassword && req.test(newPassword) ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-current" />
                      )}
                      {req.label}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {language === "vi" ? "Đang xử lý..." : "Processing..."}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    {language === "vi" ? "Đặt mật khẩu" : "Set Password"}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
