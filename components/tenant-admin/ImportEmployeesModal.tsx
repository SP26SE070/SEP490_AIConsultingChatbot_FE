"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Download, Upload, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import {
  downloadEmployeeImportTemplate,
  previewEmployeeImport,
  confirmEmployeeImport,
  type EmployeeImportPreviewResponse,
  type EmployeeImportConfirmResponse,
} from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import {
  translateImportApiError,
  translateImportRowError,
  type ImportErrorLang,
} from "@/lib/i18n/employee-import-errors";
import { AnimatedModal } from "@/components/ui/AnimatedModal";

type Step = "upload" | "preview" | "done";
type PreviewTab = "valid" | "invalid";

const COPY = {
  vi: {
    title: "Nhập nhân viên",
    subtitle: "Tải file mẫu, kiểm tra danh sách, rồi xác nhận nhập.",
    downloadTemplate: "Tải file mẫu",
    dropHint: "Kéo thả file .xlsx hoặc chọn file",
    preview: "Xem trước",
    selectFile: "Vui lòng chọn file .xlsx",
    downloadFail: "Tải file mẫu thất bại",
    previewFail: "Xem trước thất bại",
    importFail: "Nhập dữ liệu thất bại",
    total: "Tổng nhân viên",
    canImport: "Nhập được",
    cannotImport: "Không nhập được",
    stt: "STT",
    fullName: "Họ tên",
    email: "Email",
    role: "Vai trò",
    dept: "Phòng ban",
    reasons: "Lý do",
    noCanImport: "Không có nhân viên nào nhập được. Sửa file và thử lại.",
    back: "Quay lại",
    confirm: (n: number) => `Xác nhận nhập (${n})`,
    cancel: "Hủy",
    close: "Đóng",
    success: (created: number, failed: number, queued: number) =>
      `Đã tạo: ${created}, lỗi: ${failed}, email đã xếp hàng: ${queued}`,
    successToast: (created: number, queued: number) =>
      `Đã tạo ${created} nhân viên. Email chào mừng đang được gửi nền (${queued} email).`,
    failRow: (row: number, msg: string) => `Dòng file ${row}: ${msg}`,
  },
  en: {
    title: "Import employees",
    subtitle: "Download the template, review the list, then confirm.",
    downloadTemplate: "Download template",
    dropHint: "Drop a .xlsx file or browse",
    preview: "Preview",
    selectFile: "Please select a .xlsx file",
    downloadFail: "Failed to download template",
    previewFail: "Preview failed",
    importFail: "Import failed",
    total: "Total",
    canImport: "Can import",
    cannotImport: "Cannot import",
    stt: "No.",
    fullName: "Name",
    email: "Email",
    role: "Role",
    dept: "Department",
    reasons: "Reasons",
    noCanImport: "No employees can be imported. Fix the file and try again.",
    back: "Back",
    confirm: (n: number) => `Confirm import (${n})`,
    cancel: "Cancel",
    close: "Close",
    success: (created: number, failed: number, queued: number) =>
      `Created: ${created}, failed: ${failed}, emails queued: ${queued}`,
    successToast: (created: number, queued: number) =>
      `Imported ${created} employee(s). Welcome emails are being sent (${queued} queued).`,
    failRow: (row: number, msg: string) => `File row ${row}: ${msg}`,
  },
} as const;

const panelMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
};

interface ImportEmployeesModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ImportEmployeesModal({ open, onClose, onSuccess }: ImportEmployeesModalProps) {
  const { language } = useLanguageStore();
  const lang: ImportErrorLang = language === "en" ? "en" : "vi";
  const t = COPY[lang];
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EmployeeImportPreviewResponse | null>(null);
  const [result, setResult] = useState<EmployeeImportConfirmResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("valid");

  const motionProps = reduceMotion ? {} : panelMotion;

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setPreviewTab("valid");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    setError(null);
    setLoading(true);
    try {
      await downloadEmployeeImportTemplate();
    } catch (e) {
      const raw = e instanceof Error ? e.message : t.downloadFail;
      setError(e instanceof Error ? translateImportApiError(raw, lang) : t.downloadFail);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setError(t.selectFile);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await previewEmployeeImport(file);
      setPreview(data);
      setPreviewTab(data.summary.invalid > 0 && data.summary.valid === 0 ? "invalid" : "valid");
      setStep("preview");
    } catch (e) {
      const raw = e instanceof Error ? e.message : t.previewFail;
      setError(e instanceof Error ? translateImportApiError(raw, lang) : t.previewFail);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview?.importSessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await confirmEmployeeImport(preview.importSessionId);
      setResult(data);
      setStep("done");
      onSuccess(t.successToast(data.createdCount, data.emailsQueued));
    } catch (e) {
      const raw = e instanceof Error ? e.message : t.importFail;
      setError(e instanceof Error ? translateImportApiError(raw, lang) : t.importFail);
    } finally {
      setLoading(false);
    }
  };

  const tabBtn = (active: boolean, tone: "valid" | "invalid") => {
    const activeValid =
      "border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400";
    const activeInvalid = "border-b-2 border-red-500 text-red-700 dark:text-red-400";
    const idle = "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";
    return active ? (tone === "valid" ? activeValid : activeInvalid) : idle;
  };

  return (
    <AnimatedModal
      open={open}
      onClose={handleClose}
      panelClassName="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.title}</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div key="upload" className="space-y-4" {...motionProps}>
              <button
                type="button"
                onClick={() => void handleDownloadTemplate()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" />
                {t.downloadTemplate}
              </button>

              <div
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-10 dark:border-zinc-700 dark:bg-zinc-900/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f?.name.endsWith(".xlsx")) setFile(f);
                }}
              >
                <FileSpreadsheet className="mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-500" />
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {file ? file.name : t.dropHint}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="mt-4 text-xs text-zinc-600 dark:text-zinc-400"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <button
                type="button"
                disabled={loading || !file}
                onClick={() => void handlePreview()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t.preview}
              </button>
            </motion.div>
          )}

          {step === "preview" && preview && (
            <motion.div key="preview" className="space-y-4" {...motionProps}>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="font-bold text-zinc-900 dark:text-white">{preview.summary.total}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.total}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/40">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">{preview.summary.valid}</div>
                  <div className="text-xs text-emerald-700/80 dark:text-emerald-500">{t.canImport}</div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/40">
                  <div className="font-bold text-red-700 dark:text-red-400">{preview.summary.invalid}</div>
                  <div className="text-xs text-red-700/80 dark:text-red-500">{t.cannotImport}</div>
                </div>
              </div>

              <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPreviewTab("valid")}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${tabBtn(previewTab === "valid", "valid")}`}
                >
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  {t.canImport} ({preview.validRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("invalid")}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-200 ${tabBtn(previewTab === "invalid", "invalid")}`}
                >
                  <XCircle className="mr-1 inline h-4 w-4" />
                  {t.cannotImport} ({preview.invalidRows.length})
                </button>
              </div>

              {(() => {
                const rows =
                  previewTab === "valid" ? preview.validRows : preview.invalidRows;
                const tableScroll = rows.length > 8;
                return (
                  <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={previewTab}
                        initial={reduceMotion ? false : { opacity: 0, x: previewTab === "valid" ? -12 : 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, x: previewTab === "valid" ? 12 : -12 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className={tableScroll ? "max-h-64 overflow-auto" : ""}
                      >
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 z-10 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {previewTab === "valid" ? (
                              <tr>
                                <th className="w-10 px-2 py-2">{t.stt}</th>
                                <th className="px-2 py-2">{t.fullName}</th>
                                <th className="px-2 py-2">{t.email}</th>
                                <th className="px-2 py-2">{t.role}</th>
                                <th className="px-2 py-2">{t.dept}</th>
                              </tr>
                            ) : (
                              <tr>
                                <th className="w-10 px-2 py-2">{t.stt}</th>
                                <th className="px-2 py-2">{t.fullName}</th>
                                <th className="px-2 py-2">{t.email}</th>
                                <th className="px-2 py-2">{t.reasons}</th>
                              </tr>
                            )}
                          </thead>
                          <tbody className="text-zinc-800 dark:text-zinc-200">
                            {previewTab === "valid"
                              ? preview.validRows.map((r) => (
                                  <tr
                                    key={`valid-${r.rowNumber}`}
                                    className="border-t border-zinc-100 dark:border-zinc-800"
                                  >
                                    <td className="px-2 py-1.5 font-medium tabular-nums">
                                      {r.stt ?? "—"}
                                    </td>
                                    <td className="px-2 py-1.5">{r.fullName}</td>
                                    <td className="px-2 py-1.5">{r.contactEmail}</td>
                                    <td className="px-2 py-1.5">{r.roleCode}</td>
                                    <td className="px-2 py-1.5">{r.departmentCode ?? "—"}</td>
                                  </tr>
                                ))
                              : preview.invalidRows.map((r) => (
                                  <tr
                                    key={`invalid-${r.rowNumber}`}
                                    className="border-t border-zinc-100 align-top dark:border-zinc-800"
                                  >
                                    <td className="px-2 py-1.5 font-medium tabular-nums">
                                      {r.stt ?? "—"}
                                    </td>
                                    <td className="px-2 py-1.5">{r.fullName ?? "—"}</td>
                                    <td className="px-2 py-1.5 max-w-[120px] truncate">
                                      {r.contactEmail ?? "—"}
                                    </td>
                                    <td className="px-2 py-1.5 leading-snug text-red-700 dark:text-red-400">
                                      {(r.errors?.length ?? 0) > 0 ? (
                                        <ul className="list-disc space-y-0.5 pl-4">
                                          {r.errors.map((msg, i) => (
                                            <li key={i}>{translateImportRowError(msg, lang)}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                          </tbody>
                        </table>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                );
              })()}

              {preview.summary.valid === 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-400">{t.noCanImport}</p>
              )}
            </motion.div>
          )}

          {step === "done" && result && (
            <motion.div key="done" className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300" {...motionProps}>
              <p className="text-emerald-700 dark:text-emerald-400">
                {t.success(result.createdCount, result.failedCount, result.emailsQueued)}
              </p>
              {result.failed.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-red-700 dark:text-red-400">
                  {result.failed.map((f) => (
                    <li key={f.rowNumber}>
                      {t.failRow(
                        f.rowNumber,
                        translateImportRowError(f.message, lang) ||
                          translateImportApiError(f.message, lang)
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        {step === "preview" && (
          <>
            <button
              type="button"
              onClick={() => {
                setStep("upload");
                setPreview(null);
              }}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {t.back}
            </button>
            <button
              type="button"
              disabled={loading || !preview || preview.summary.valid === 0}
              onClick={() => void handleConfirm()}
              className="ml-auto rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {loading ? (
                <Loader2 className="inline h-4 w-4 animate-spin" />
              ) : (
                t.confirm(preview.summary.valid)
              )}
            </button>
          </>
        )}
        {step !== "preview" && (
          <button
            type="button"
            onClick={handleClose}
            className="ml-auto rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {step === "done" ? t.close : t.cancel}
          </button>
        )}
      </div>
    </AnimatedModal>
  );
}
