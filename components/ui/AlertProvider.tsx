"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LucideIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "@/components/ui/Toast";
import { parseApiErrorMessage } from "@/lib/api/parseApiError";
import { useLanguageStore } from "@/lib/language-store";

type NotificationType = "error" | "success" | "info";

type NotificationState = {
  id: number;
  message: string;
  type: NotificationType;
};

type ToastConfig = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

const toastConfigs: Record<NotificationType, ToastConfig> = {
  error: {
    icon: AlertCircle,
    iconBg: "bg-red-100 dark:bg-red-900/50",
    iconColor: "text-red-500",
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    iconColor: "text-emerald-500",
  },
  info: {
    icon: Info,
    iconBg: "bg-sky-100 dark:bg-sky-900/50",
    iconColor: "text-sky-500",
  },
};

function detectTone(message: string): NotificationType {
  const text = message.toLowerCase();
  if (
    text.includes("thành công") ||
    text.includes("success") ||
    text.includes("đã gửi")
  ) {
    return "success";
  }
  if (
    text.includes("lỗi") ||
    text.includes("thất bại") ||
    text.includes("failed") ||
    text.includes("error") ||
    text.includes("không thể")
  ) {
    return "error";
  }
  return "info";
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [notificationState, setNotificationState] = useState<NotificationState | null>(null);
  const { language } = useLanguageStore();

  const titles = useMemo(() => {
    const isEn = language === "en";
    return {
      error: isEn ? "Error" : "Có lỗi xảy ra",
      success: isEn ? "Success" : "Thành công",
      info: isEn ? "Notice" : "Thông báo",
      ok: isEn ? "OK" : "Đóng",
      close: isEn ? "Close notification" : "Đóng thông báo",
    };
  }, [language]);

  // Intercept window.alert to show toast instead
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const originalAlert = window.alert.bind(window);

    window.alert = (message?: string) => {
      const normalizedMessage =
        typeof message === "string" ? message : String(message ?? "");
      const parsedMessage = parseApiErrorMessage(normalizedMessage);
      const type = detectTone(parsedMessage);

      // Show as toast notification
      if (type === "success") {
        toast.success(parsedMessage);
      } else if (type === "error") {
        toast.error(parsedMessage);
      } else {
        toast.info(parsedMessage);
      }

      // Also set notification state for modal style if needed
      setNotificationState({
        id: Date.now(),
        message: parsedMessage,
        type,
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Auto dismiss notification modal after timeout
  useEffect(() => {
    if (!notificationState) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setNotificationState((current) =>
        current?.id === notificationState.id ? null : current
      );
    }, 5500);
    return () => window.clearTimeout(timeout);
  }, [notificationState]);

  const config = useMemo(
    () => (notificationState ? toastConfigs[notificationState.type] : null),
    [notificationState]
  );

  const handleClose = useCallback(() => {
    setNotificationState(null);
  }, []);

  return (
    <>
      {children}
      <ToastContainer />

      <AnimatePresence>
        {notificationState && config && (
          <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />

            <motion.div
              className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 ${
                notificationState.type === "error"
                  ? "ring-1 ring-red-500/40"
                  : notificationState.type === "success"
                    ? "ring-1 ring-emerald-500/40"
                    : "ring-1 ring-sky-500/40"
              }`}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                className="absolute right-3 top-3 rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={handleClose}
                aria-label={titles.close}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-3 flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${config.iconBg}`}>
                  <config.icon className={`h-5 w-5 ${config.iconColor}`} />
                </div>
                <p className="text-sm font-semibold tracking-wide">
                  {notificationState.type === "error"
                    ? titles.error
                    : notificationState.type === "success"
                      ? titles.success
                      : titles.info}
                </p>
              </div>

              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-100">
                {notificationState.message}
              </p>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className={`rounded-full border px-6 py-2 text-sm font-semibold transition ${
                    notificationState.type === "error"
                      ? "border-red-300/70 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-100 dark:hover:bg-red-400/25"
                      : notificationState.type === "success"
                        ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-100 dark:hover:bg-emerald-400/25"
                        : "border-sky-300/70 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-100 dark:hover:bg-sky-400/25"
                  }`}
                  onClick={handleClose}
                >
                  {titles.ok}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Export convenience functions for direct use
export { toast } from "@/components/ui/Toast";

