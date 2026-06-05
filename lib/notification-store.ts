"use client";

import { create } from "zustand";

export type NotificationType = "success" | "error" | "info" | "warning";

export type NotificationOptions = {
  title?: string;
  message: string;
  type: NotificationType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type Notification = NotificationOptions & {
  id: string;
  createdAt: number;
};

type NotificationStore = {
  notifications: Notification[];
  addNotification: (options: NotificationOptions) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
};

let idCounter = 0;

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  addNotification: (options) => {
    const id = `notification-${++idCounter}-${Date.now()}`;
    const notification: Notification = {
      ...options,
      id,
      createdAt: Date.now(),
      duration: options.duration ?? 5000,
    };

    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notification.duration);
    }

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));

// Convenience functions
export const toast = {
  success: (message: string, options?: Partial<NotificationOptions>) =>
    useNotificationStore.getState().addNotification({
      message,
      type: "success",
      ...options,
    }),

  error: (message: string, options?: Partial<NotificationOptions>) =>
    useNotificationStore.getState().addNotification({
      message,
      type: "error",
      duration: options?.duration ?? 7000,
      ...options,
    }),

  info: (message: string, options?: Partial<NotificationOptions>) =>
    useNotificationStore.getState().addNotification({
      message,
      type: "info",
      ...options,
    }),

  warning: (message: string, options?: Partial<NotificationOptions>) =>
    useNotificationStore.getState().addNotification({
      message,
      type: "warning",
      duration: options?.duration ?? 6000,
      ...options,
    }),
};
