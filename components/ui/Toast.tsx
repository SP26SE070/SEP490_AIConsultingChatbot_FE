"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LucideIcon,
  AlertTriangle,
  X,
} from "lucide-react";
import { useCallback } from "react";
import {
  useNotificationStore,
  type NotificationType,
} from "@/lib/notification-store";
import { useLanguageStore } from "@/lib/language-store";

type ToastConfig = {
  icon: LucideIcon;
  title: string;
  iconColor: string;
  bgGradient: string;
  borderColor: string;
  titleColor: string;
  progressColor: string;
  buttonBg: string;
  buttonHover: string;
};

const toastConfigs: Record<NotificationType, ToastConfig> = {
  success: {
    icon: CheckCircle2,
    title: "Thành công",
    iconColor: "text-emerald-500",
    bgGradient: "bg-gradient-to-br from-emerald-50/95 to-teal-50/95 dark:from-emerald-950/90 dark:to-teal-950/90",
    borderColor: "border-emerald-200/60 dark:border-emerald-800/50",
    titleColor: "text-emerald-800 dark:text-emerald-200",
    progressColor: "bg-emerald-500",
    buttonBg: "bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-300",
    buttonHover: "hover:bg-emerald-200 dark:hover:bg-emerald-800/60",
  },
  error: {
    icon: AlertCircle,
    title: "Có lỗi xảy ra",
    iconColor: "text-red-500",
    bgGradient: "bg-gradient-to-br from-red-50/95 to-rose-50/95 dark:from-red-950/90 dark:to-rose-950/90",
    borderColor: "border-red-200/60 dark:border-red-800/50",
    titleColor: "text-red-800 dark:text-red-200",
    progressColor: "bg-red-500",
    buttonBg: "bg-red-100 border-red-200 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300",
    buttonHover: "hover:bg-red-200 dark:hover:bg-red-800/60",
  },
  warning: {
    icon: AlertTriangle,
    title: "Cảnh báo",
    iconColor: "text-amber-500",
    bgGradient: "bg-gradient-to-br from-amber-50/95 to-orange-50/95 dark:from-amber-950/90 dark:to-orange-950/90",
    borderColor: "border-amber-200/60 dark:border-amber-800/50",
    titleColor: "text-amber-800 dark:text-amber-200",
    progressColor: "bg-amber-500",
    buttonBg: "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/50 dark:border-amber-700 dark:text-amber-300",
    buttonHover: "hover:bg-amber-200 dark:hover:bg-amber-800/60",
  },
  info: {
    icon: Info,
    title: "Thông báo",
    iconColor: "text-sky-500",
    bgGradient: "bg-gradient-to-br from-sky-50/95 to-blue-50/95 dark:from-sky-950/90 dark:to-blue-950/90",
    borderColor: "border-sky-200/60 dark:border-sky-800/50",
    titleColor: "text-sky-800 dark:text-sky-200",
    progressColor: "bg-sky-500",
    buttonBg: "bg-sky-100 border-sky-200 text-sky-700 dark:bg-sky-900/50 dark:border-sky-700 dark:text-sky-300",
    buttonHover: "hover:bg-sky-200 dark:hover:bg-sky-800/60",
  },
};

const englishTitles: Record<NotificationType, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Information",
};

function ToastItem({
  notification,
}: {
  notification: {
    id: string;
    message: string;
    type: NotificationType;
    duration?: number;
    action?: { label: string; onClick: () => void };
    createdAt: number;
  };
}) {
  const { language } = useLanguageStore();
  const removeNotification = useNotificationStore(
    (s) => s.removeNotification
  );
  const config = toastConfigs[notification.type];
  const Icon = config.icon;

  const handleClose = useCallback(() => {
    removeNotification(notification.id);
  }, [notification.id, removeNotification]);

  const isEn = language === "en";
  const title = isEn ? englishTitles[notification.type] : config.title;
  const okText = isEn ? "OK" : "Đóng";
  const closeText = isEn ? "Close" : "Đóng";

  const duration = notification.duration ?? 5000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-xl shadow-black/10 dark:shadow-black/40"
      style={{
        background: "transparent",
      }}
    >
      {/* Backdrop for proper layering */}
      <div
        className={`${config.bgGradient} ${config.borderColor} border backdrop-blur-sm`}
      >
        {/* Progress bar */}
        {duration > 0 && (
          <motion.div
            className={`h-0.5 ${config.progressColor}`}
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: duration / 1000, ease: "linear" }}
          />
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notification.type === "success" ? "bg-emerald-100 dark:bg-emerald-900/50" : notification.type === "error" ? "bg-red-100 dark:bg-red-900/50" : notification.type === "warning" ? "bg-amber-100 dark:bg-amber-900/50" : "bg-sky-100 dark:bg-sky-900/50"}`}
            >
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${config.titleColor}`}>
                {title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {notification.message}
              </p>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label={closeText}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-200/60 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex items-center justify-end gap-2">
            {notification.action ? (
              <>
                <button
                  type="button"
                  onClick={notification.action.onClick}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${config.buttonBg} ${config.buttonHover}`}
                >
                  {notification.action.label}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${config.buttonBg} ${config.buttonHover}`}
                >
                  {okText}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition ${config.buttonBg} ${config.buttonHover}`}
              >
                {okText}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-0 z-[99999] flex flex-col items-end justify-start p-4 gap-2"
      style={{ perspective: "1000px" }}
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <ToastItem
            key={notification.id}
            notification={notification}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
