"use client";

import { useState } from "react";
import { EmployeeManagementNew } from "@/components/tenant-admin/EmployeeManagementNew";
import { CreateUserModal } from "@/components/tenant-admin/CreateUserModal";
import { ImportEmployeesModal } from "@/components/tenant-admin/ImportEmployeesModal";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

export default function EmployeesPage() {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  return (
      <div className="space-y-6">
        {/* Feedback Message */}
        {feedback && (
          <div
            role="status"
            className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              feedback.tone === "error"
                ? "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100"
                : feedback.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
            }`}
          >
            <div className="flex items-start gap-2">
              {feedback.tone === "error" || feedback.tone === "warning" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
              )}
              <p>{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Employee Management */}
        <EmployeeManagementNew
          key={refreshKey}
          onOpenCreate={() => {
            setFeedback(null);
            setCreateOpen(true);
          }}
          onOpenImport={() => {
            setFeedback(null);
            setImportOpen(true);
          }}
          onActionSuccess={(message) => {
            setFeedback({ tone: "success", message });
            setRefreshKey((k) => k + 1);
          }}
          onActionError={(message) => {
            setFeedback({ tone: "error", message });
          }}
        />

        {/* Create User Modal */}
        <CreateUserModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setRefreshKey((k) => k + 1);
            setFeedback({
              tone: "success",
              message: isEn
                ? "User created successfully. Welcome email is being sent."
                : "Tạo người dùng thành công. Email chào mừng đang được gửi.",
            });
          }}
        />

        <ImportEmployeesModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={(message) => {
            setRefreshKey((k) => k + 1);
            setFeedback({ tone: "success", message });
            setImportOpen(false);
          }}
        />
      </div>
  );
}

