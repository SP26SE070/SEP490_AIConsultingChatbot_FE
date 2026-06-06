import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClockIcon,
  LanguageIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useLanguageStore } from "@/lib/language-store";
import { getPermissionLabel } from "@/lib/permission-labels";
import {
  getMyOnboardingModuleAttachment,
  type OnboardingAttachmentContent,
} from "@/lib/api/onboarding";
import type { OnboardingMyOverviewResponse } from "@/types/onboarding";

interface OnboardingModalProps {
  isOpen: boolean;
  isLoading: boolean;
  overview: OnboardingMyOverviewResponse | null;
  processingModuleId: string | null;
  onClose: () => void;
  onMarkCompleted: (moduleId: string) => Promise<boolean>;
}

type ParsedBilingualContent = {
  vi: string;
  en: string;
};

type ReadableLine = {
  key: string;
  type: "heading" | "bullet" | "paragraph" | "spacer";
  text: string;
};

function formatDateTimeByLanguage(value: string | null | undefined, language: "vi" | "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(language === "en" ? "en-US" : "vi-VN");
}

function normalizeContentText(rawContent: string): string {
  return rawContent.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function parseBilingualContent(rawContent: string): ParsedBilingualContent {
  const normalized = normalizeContentText(rawContent);
  const viToken = "[VI]";
  const enToken = "[EN]";
  const viIndex = normalized.indexOf(viToken);
  const enIndex = normalized.indexOf(enToken);

  if (viIndex >= 0 && enIndex > viIndex) {
    const vi = normalized.slice(viIndex + viToken.length, enIndex).trim();
    const en = normalized.slice(enIndex + enToken.length).trim();
    return {
      vi: vi || normalized,
      en: en || vi || normalized,
    };
  }

  if (enIndex >= 0 && viIndex > enIndex) {
    const en = normalized.slice(enIndex + enToken.length, viIndex).trim();
    const vi = normalized.slice(viIndex + viToken.length).trim();
    return {
      vi: vi || en || normalized,
      en: en || vi || normalized,
    };
  }

  if (enIndex >= 0) {
    const en = normalized.slice(enIndex + enToken.length).trim();
    return {
      vi: en || normalized,
      en: en || normalized,
    };
  }

  return {
    vi: normalized,
    en: normalized,
  };
}

function hasVietnameseChars(text: string): boolean {
  return /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
    text
  );
}

function parseInlineBilingual(rawText: string): ParsedBilingualContent {
  const normalized = rawText.trim();

  if (!normalized) {
    return { vi: "", en: "" };
  }

  // Prefer explicit tokens if provided in title/summary.
  if (normalized.includes("[VI]") || normalized.includes("[EN]")) {
    return parseBilingualContent(normalized);
  }

  const separator = " / ";
  const splitIndex = normalized.indexOf(separator);
  if (splitIndex < 0) {
    return {
      vi: normalized,
      en: normalized,
    };
  }

  const vi = normalized.slice(0, splitIndex).trim();
  const en = normalized.slice(splitIndex + separator.length).trim();

  // Only treat as bilingual if we can reasonably infer VI + EN parts.
  const looksBilingual =
    vi.length > 0 &&
    en.length > 0 &&
    hasVietnameseChars(vi) &&
    !hasVietnameseChars(en);
  if (!looksBilingual) {
    return {
      vi: normalized,
      en: normalized,
    };
  }

  return {
    vi: vi || normalized,
    en: en || vi || normalized,
  };
}

function pickInlineText(rawText: string, language: "vi" | "en"): string {
  const parsed = parseInlineBilingual(rawText);
  return language === "en" ? parsed.en : parsed.vi;
}

function parseReadableLines(rawContent: string): ReadableLine[] {
  const normalized = normalizeContentText(rawContent);
  if (!normalized) return [];

  return normalized.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return {
        key: `spacer-${index}`,
        type: "spacer",
        text: "",
      };
    }

    const bulletMatch = trimmed.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (bulletMatch?.[2]) {
      return {
        key: `bullet-${index}`,
        type: "bullet",
        text: bulletMatch[2].trim(),
      };
    }

    if (trimmed.endsWith(":")) {
      return {
        key: `heading-${index}`,
        type: "heading",
        text: trimmed,
      };
    }

    return {
      key: `paragraph-${index}`,
      type: "paragraph",
      text: trimmed,
    };
  });
}

export function OnboardingModal({
  isOpen,
  isLoading,
  overview,
  processingModuleId,
  onClose,
  onMarkCompleted,
}: OnboardingModalProps) {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const modules = useMemo(() => overview?.modules ?? [], [overview]);
  const progress = overview?.progressPercent ?? 0;
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentContent, setAttachmentContent] =
    useState<OnboardingAttachmentContent | null>(null);
  const [markActionModuleId, setMarkActionModuleId] = useState<string | null>(null);
  const [successPulseModuleId, setSuccessPulseModuleId] = useState<string | null>(null);

  const moduleContentMap = useMemo(() => {
    const map = new Map<string, ParsedBilingualContent>();
    modules.forEach((module) => {
      map.set(module.id, parseBilingualContent(module.content));
    });
    return map;
  }, [modules]);

  const selectedModule = useMemo(
    () => modules.find((module) => module.id === selectedModuleId) ?? null,
    [modules, selectedModuleId]
  );

  const selectedModuleContent = useMemo(() => {
    if (!selectedModule) return null;
    return (
      moduleContentMap.get(selectedModule.id) ?? {
        vi: normalizeContentText(selectedModule.content),
        en: normalizeContentText(selectedModule.content),
      }
    );
  }, [moduleContentMap, selectedModule]);

  const detailText =
    language === "en"
      ? selectedModuleContent?.en ?? ""
      : selectedModuleContent?.vi ?? "";

  const readableDetailLines = useMemo(
    () => parseReadableLines(detailText),
    [detailText]
  );

  const readableAttachmentTextLines = useMemo(
    () =>
      attachmentContent?.kind === "text"
        ? parseReadableLines(
            language === "en"
              ? parseBilingualContent(attachmentContent.text).en
              : parseBilingualContent(attachmentContent.text).vi
          )
        : [],
    [attachmentContent, language]
  );

  const selectedModuleTitle = useMemo(() => {
    if (!selectedModule) return "";
    return pickInlineText(selectedModule.title, language);
  }, [selectedModule, language]);

  const selectedModuleSummary = useMemo(() => {
    if (!selectedModule?.summary) return "";
    return pickInlineText(selectedModule.summary, language);
  }, [selectedModule, language]);

  const t = useMemo(
    () => ({
      closeOnboarding: isEn ? "Close onboarding" : "Đóng onboarding",
      checklistTitle: isEn ? "Personal onboarding checklist" : "Checklist onboarding cá nhân",
      checklistDescription: isEn
        ? "Click each card to open the detailed content. Language follows your current setting."
        : "Nhấn vào từng card để mở cửa sổ chi tiết nội dung. Ngôn ngữ hiển thị phụ thuộc vào setting hiện tại.",
      totalLabel: isEn ? "Total" : "Tổng",
      completedLabel: isEn ? "Completed" : "Hoàn thành",
      displayByLabel: isEn ? "Display by" : "Hiển thị theo",
      totalProgressLabel: isEn ? "Overall progress" : "Tiến độ tổng",
      loadingOnboarding: isEn ? "Loading onboarding content..." : "Đang tải nội dung onboarding...",
      noOnboardingModule: isEn
        ? "Your tenant has not configured onboarding modules yet."
        : "Tenant của bạn chưa khai báo module onboarding.",
      minuteSuffix: isEn ? "min" : "phút",
      permissionsRequired: isEn ? "Required permissions" : "Yêu cầu quyền",
      openDetailHint: isEn ? "Click to open detailed content" : "Nhấn để mở cửa sổ nội dung chi tiết",
      closeDetailWindow: isEn ? "Close detail window" : "Đóng cửa sổ chi tiết",
      detailFileLabel: isEn ? "Detail file" : "File chi tiết",
      displayingLabel: isEn ? "Displaying" : "Đang hiển thị",
      loadingDetailFile: isEn
        ? "Loading onboarding detail file..."
        : "Đang tải file chi tiết onboarding...",
      attachmentLoadError: isEn
        ? "Unable to load onboarding detail file."
        : "Không tải được file chi tiết onboarding.",
      pdfPreviewTitle: isEn ? "Onboarding attachment preview" : "Xem trước file onboarding",
      unsupportedFile: isEn
        ? "Detail file format {mime} is not supported for inline rendering yet."
        : "File chi tiết có định dạng {mime}, chưa hỗ trợ hiển thị trực tiếp.",
      doneLabel: isEn ? "Completed" : "Đã hoàn thành",
      updatingLabel: isEn ? "Updating..." : "Đang cập nhật...",
      markCompleted: isEn ? "Mark as read" : "Đánh dấu đã đọc xong",
      moduleWord: isEn ? "modules" : "module",
    }),
    [isEn]
  );

  const detailLanguage = language === "en" ? "English" : "Tiếng Việt";

  const clearAttachmentState = () => {
    setAttachmentLoading(false);
    setAttachmentError(null);
    setAttachmentContent((prev) => {
      if (prev?.kind === "pdf") {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });
  };

  const openDetailModal = (moduleId: string, hasAttachment: boolean) => {
    clearAttachmentState();
    setAttachmentLoading(hasAttachment);
    setSelectedModuleId(moduleId);
  };

  const closeDetailModal = () => {
    clearAttachmentState();
    setSelectedModuleId(null);
  };

  useEffect(() => {
    const currentPdfUrl = attachmentContent?.kind === "pdf" ? attachmentContent.url : null;
    return () => {
      if (currentPdfUrl) {
        URL.revokeObjectURL(currentPdfUrl);
      }
    };
  }, [attachmentContent]);

  useEffect(() => {
    if (!successPulseModuleId) return;

    const timer = window.setTimeout(() => {
      setSuccessPulseModuleId(null);
    }, 550);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successPulseModuleId]);

  useEffect(() => {
    let isActive = true;

    if (!selectedModule?.detailFileName) {
      return () => {
        isActive = false;
      };
    }

    void getMyOnboardingModuleAttachment(selectedModule.id)
      .then((payload) => {
        if (!isActive) {
          if (payload.kind === "pdf") {
            URL.revokeObjectURL(payload.url);
          }
          return;
        }
        setAttachmentContent(payload);
      })
      .catch((error) => {
        if (!isActive) return;
        setAttachmentError(
          error instanceof Error
            ? error.message
            : t.attachmentLoadError
        );
      })
      .finally(() => {
        if (isActive) {
          setAttachmentLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedModule?.detailFileName, selectedModule?.id, t.attachmentLoadError]);

  const closeMainModal = () => {
    closeDetailModal();
    onClose();
  };

  const handleMarkCompletedClick = async (moduleId: string) => {
    if (processingModuleId === moduleId || markActionModuleId === moduleId) {
      return;
    }

    setMarkActionModuleId(moduleId);
    const success = await onMarkCompleted(moduleId);
    setMarkActionModuleId(null);

    if (success) {
      setSuccessPulseModuleId(moduleId);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-90 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-emerald-300 bg-white shadow-2xl dark:border-emerald-900/40 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 bg-linear-to-r from-emerald-100 via-white to-cyan-100 px-6 py-5 dark:border-zinc-800 dark:from-emerald-950/50 dark:via-zinc-950 dark:to-cyan-950/40">
            <button
              type="button"
              onClick={closeMainModal}
              className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              aria-label={t.closeOnboarding}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="pr-10">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {t.checklistTitle}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t.checklistDescription}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {t.totalLabel}: {overview?.totalModules ?? 0} {t.moduleWord}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {t.completedLabel}: {overview?.completedModules ?? 0}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 font-medium text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-300">
                  <LanguageIcon className="h-3.5 w-3.5" />
                  {t.displayByLabel}: {detailLanguage}
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{t.totalProgressLabel}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-linear-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {isLoading && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {t.loadingOnboarding}
              </div>
            )}

            {!isLoading && modules.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {t.noOnboardingModule}
              </div>
            )}

            {!isLoading &&
              modules.map((module, index) => (
                // Render title/summary according to current language if seed uses "VI / EN" inline format.
                <button
                  key={module.id}
                  type="button"
                  onClick={() => openDetailModal(module.id, Boolean(module.detailFileName))}
                  className="block w-full rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/20 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700/70 dark:hover:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {index + 1}
                        </span>
                        <h3 className="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                          {pickInlineText(module.title, language)}
                        </h3>
                      </div>
                      {module.summary && (
                        <p className="mt-2 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {pickInlineText(module.summary, language)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        <ClockIcon className="h-4 w-4" />
                        ~{module.estimatedMinutes} {t.minuteSuffix}
                      </span>
                      {module.detailFileName && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-300">
                          {module.detailFileType === "application/pdf" ? "PDF" : "TXT"}
                        </span>
                      )}
                      {module.completed && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircleIcon className="h-4 w-4" />
                          {t.doneLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {module.requiredPermissions.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <BookOpenIcon className="h-4 w-4" />
                        {t.permissionsRequired}:
                      </span>
                      {module.requiredPermissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          {getPermissionLabel(permission, undefined, isEn ? "en" : "vi")}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                    {t.openDetailHint}
                  </p>
                </button>
              ))}
          </div>
        </div>
      </div>

      {selectedModule && (
        <div
          className="fixed inset-0 z-95 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={closeDetailModal}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-cyan-300 bg-white shadow-2xl dark:border-cyan-900/40 dark:bg-zinc-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
              <button
                type="button"
                onClick={closeDetailModal}
                className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label={t.closeDetailWindow}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>

              <div className="pr-10">
                <h3 className="text-2xl font-bold leading-snug text-zinc-900 dark:text-zinc-50">
                  {selectedModuleTitle}
                </h3>
                {selectedModuleSummary && (
                  <p className="mt-2 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {selectedModuleSummary}
                  </p>
                )}
                {selectedModule.detailFileName && (
                  <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {t.detailFileLabel}: {selectedModule.detailFileName}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 font-medium text-cyan-700 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-300">
                    <LanguageIcon className="h-3.5 w-3.5" />
                    {t.displayingLabel}: {detailLanguage}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    <ClockIcon className="h-3.5 w-3.5" />
                    ~{selectedModule.estimatedMinutes} {t.minuteSuffix}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {selectedModule.detailFileName ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
                  {attachmentLoading && (
                    <p className="text-base text-zinc-600 dark:text-zinc-300">
                      {t.loadingDetailFile}
                    </p>
                  )}

                  {!attachmentLoading && attachmentError && (
                    <p className="text-base text-rose-600 dark:text-rose-300">{attachmentError}</p>
                  )}

                  {!attachmentLoading && !attachmentError && attachmentContent?.kind === "pdf" && (
                    <iframe
                      src={attachmentContent.url}
                      title={t.pdfPreviewTitle}
                      className="h-[65vh] w-full rounded-xl border border-zinc-300 bg-white dark:border-zinc-700"
                    />
                  )}

                  {!attachmentLoading && !attachmentError && attachmentContent?.kind === "text" && (
                    <div className="space-y-3">
                      {readableAttachmentTextLines.map((line) => {
                        if (line.type === "spacer") {
                          return <div key={line.key} className="h-2" />;
                        }

                        if (line.type === "heading") {
                          return (
                            <h4
                              key={line.key}
                              className="pt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
                            >
                              {line.text}
                            </h4>
                          );
                        }

                        if (line.type === "bullet") {
                          return (
                            <div key={line.key} className="flex items-start gap-3">
                              <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                              <p className="text-base leading-8 text-zinc-700 dark:text-zinc-200">
                                {line.text}
                              </p>
                            </div>
                          );
                        }

                        return (
                          <p key={line.key} className="text-base leading-8 text-zinc-700 dark:text-zinc-200">
                            {line.text}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {!attachmentLoading && !attachmentError && attachmentContent?.kind === "binary" && (
                    <p className="text-base text-zinc-600 dark:text-zinc-300">
                      {t.unsupportedFile.replace(
                        "{mime}",
                        attachmentContent.mime || (isEn ? "unknown" : "không xác định")
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="space-y-3">
                    {readableDetailLines.map((line) => {
                      if (line.type === "spacer") {
                        return <div key={line.key} className="h-2" />;
                      }

                      if (line.type === "heading") {
                        return (
                          <h4
                            key={line.key}
                            className="pt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
                          >
                            {line.text}
                          </h4>
                        );
                      }

                      if (line.type === "bullet") {
                        return (
                          <div key={line.key} className="flex items-start gap-3">
                            <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                            <p className="text-base leading-8 text-zinc-700 dark:text-zinc-200">
                              {line.text}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <p key={line.key} className="text-base leading-8 text-zinc-700 dark:text-zinc-200">
                          {line.text}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div
              className={`flex flex-wrap items-center gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 ${
                selectedModule.completed ? "justify-between" : "justify-end"
              }`}
            >
              {selectedModule.completed ? (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 transition-all duration-300 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300 ${
                    successPulseModuleId === selectedModule.id
                      ? "scale-105 shadow-[0_0_0_6px_rgba(16,185,129,0.14)]"
                      : "scale-100"
                  }`}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  {t.doneLabel}
                  {selectedModule.completedAt && (
                    <span className="text-xs opacity-80">({formatDateTimeByLanguage(selectedModule.completedAt, language)})</span>
                  )}
                </div>
              ) : null}

              {!selectedModule.completed && (
                <button
                  type="button"
                  onClick={() => {
                    void handleMarkCompletedClick(selectedModule.id);
                  }}
                  disabled={processingModuleId === selectedModule.id || markActionModuleId === selectedModule.id}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-300 active:scale-95 disabled:cursor-not-allowed ${
                    processingModuleId === selectedModule.id || markActionModuleId === selectedModule.id
                      ? "bg-emerald-500/90 opacity-90"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {processingModuleId === selectedModule.id || markActionModuleId === selectedModule.id ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      {t.updatingLabel}
                    </>
                  ) : (
                    t.markCompleted
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
