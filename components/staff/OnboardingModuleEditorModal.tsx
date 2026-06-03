"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { PermissionSelector } from "@/components/permissions/PermissionSelector";
import { resolveTenantPermissionCategories, type PermissionCategoryDto } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export type OnboardingEditorState = {
  id?: string;
  title: string;
  summary: string;
  displayOrder: number;
  estimatedMinutes: number;
  requiredPermissions: string[];
  contentVi: string;
  contentEn: string;
  isActive: boolean;
  detailFileName?: string | null;
  detailFileSize?: number | null;
};

export type OnboardingEditorLabels = {
  createTitle: string;
  updateTitle: string;
  hint: string;
  formTitle: string;
  formSummary: string;
  formDisplayOrder: string;
  formEstimatedMinutes: string;
  formActive: string;
  sectionBasics: string;
  sectionPermissions: string;
  sectionPermissionsHint: string;
  sectionFile: string;
  sectionContent: string;
  loadingPermissions: string;
  formDetailFile: string;
  formCurrentFile: string;
  formWillUpload: string;
  contentVi: string;
  contentEn: string;
  cancel: string;
  saveChanges: string;
  createNow: string;
};

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const sectionClass =
  "rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/50 sm:p-5";

type Props = {
  open: boolean;
  saving: boolean;
  labels: OnboardingEditorLabels;
  state: OnboardingEditorState;
  onChange: (patch: Partial<OnboardingEditorState>) => void;
  permissionCategories: PermissionCategoryDto[];
  permissionsLoading: boolean;
  attachmentFile: File | null;
  onAttachmentChange: (file: File | null) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function OnboardingModuleEditorModal({
  open,
  saving,
  labels,
  state,
  onChange,
  permissionCategories,
  permissionsLoading,
  attachmentFile,
  onAttachmentChange,
  onClose,
  onSubmit,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const title = state.id ? labels.updateTitle : labels.createTitle;
  const submitLabel = state.id ? labels.saveChanges : labels.createNow;

  return createPortal(
    <div className="onboarding-module-editor-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal
        aria-labelledby="onboarding-module-editor-title"
        className="relative flex w-full max-w-4xl max-h-[min(88dvh,52rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] dark:border-zinc-700/90 dark:bg-zinc-950"
      >
        <div className="relative shrink-0 border-b border-zinc-200/90 px-5 py-4 dark:border-zinc-800 sm:px-6">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-blue-500 via-cyan-400 to-blue-600" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 pr-2">
              <h2
                id="onboarding-module-editor-title"
                className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-xl"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{labels.hint}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label={labels.cancel}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:space-y-5 sm:px-6 sm:py-5">
            <section className={sectionClass}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {labels.sectionBasics}
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{labels.formTitle}</label>
                  <input
                    value={state.title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    className={fieldClass}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{labels.formSummary}</label>
                  <input
                    value={state.summary}
                    onChange={(e) => onChange({ summary: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{labels.formDisplayOrder}</label>
                  <input
                    type="number"
                    min={0}
                    value={state.displayOrder}
                    onChange={(e) => onChange({ displayOrder: Number(e.target.value) })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{labels.formEstimatedMinutes}</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={state.estimatedMinutes}
                    onChange={(e) => onChange({ estimatedMinutes: Number(e.target.value) })}
                    className={fieldClass}
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <label className="inline-flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900 sm:w-auto sm:min-w-[12rem]">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{labels.formActive}</span>
                    <span className="relative inline-flex h-6 w-11 items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={state.isActive}
                        onChange={(e) => onChange({ isActive: e.target.checked })}
                      />
                      <span className="absolute inset-0 rounded-full bg-zinc-300 transition peer-checked:bg-blue-600 dark:bg-zinc-600" />
                      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {labels.sectionPermissions}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {labels.sectionPermissionsHint}
                </p>
              </div>
              <div className="mt-3">
                {permissionsLoading ? (
                  <p className="text-sm text-zinc-500">{labels.loadingPermissions}</p>
                ) : (
                  <PermissionSelector
                    layout="grid"
                    selected={state.requiredPermissions}
                    categories={resolveTenantPermissionCategories(permissionCategories)}
                    onChange={(requiredPermissions) => onChange({ requiredPermissions })}
                    disabled={saving}
                  />
                )}
              </div>
            </section>

            <section className={sectionClass}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {labels.sectionFile}
              </h3>
              {state.detailFileName && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {labels.formCurrentFile}: {state.detailFileName}
                  {state.detailFileSize
                    ? ` (${Math.max(1, Math.round(state.detailFileSize / 1024))} KB)`
                    : ""}
                </p>
              )}
              <input
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  onAttachmentChange(file);
                  if (file) event.currentTarget.value = "";
                }}
                className={cn(
                  fieldClass,
                  "mt-3 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 dark:file:bg-blue-950/60 dark:file:text-blue-300"
                )}
              />
              {attachmentFile && (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  {labels.formWillUpload}: {attachmentFile.name}
                </p>
              )}
            </section>

            <section className={sectionClass}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {labels.sectionContent}
              </h3>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{labels.contentVi}</label>
                  <textarea
                    value={state.contentVi}
                    onChange={(e) => onChange({ contentVi: e.target.value })}
                    rows={6}
                    className={cn(fieldClass, "min-h-[9rem] resize-none leading-relaxed")}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{labels.contentEn}</label>
                  <textarea
                    value={state.contentEn}
                    onChange={(e) => onChange({ contentEn: e.target.value })}
                    rows={6}
                    className={cn(fieldClass, "min-h-[9rem] resize-none leading-relaxed")}
                    required
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-200/90 bg-zinc-50/90 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/80 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
