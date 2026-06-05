"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createStaffOnboardingModule,
  deactivateStaffOnboardingModule,
  getStaffOnboardingAvailablePermissions,
  getStaffOnboardingModules,
  uploadStaffOnboardingModuleAttachment,
  updateStaffOnboardingModule,
} from "@/lib/api/onboarding";
import {
  OnboardingModuleEditorModal,
  type OnboardingEditorLabels,
} from "@/components/staff/OnboardingModuleEditorModal";
import { getPermissionLabel } from "@/lib/permission-labels";
import {
  buildPermissionLabelMap,
  resolveTenantPermissionCategories,
  type PermissionCategoryDto,
} from "@/lib/permissions";
import { dashboardPanelClass } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils/cn";
import { useLanguageStore } from "@/lib/language-store";
import { toast } from "@/components/ui/AlertProvider";
import type {
  OnboardingModuleResponse,
  UpdateOnboardingModuleRequest,
} from "@/types/onboarding";
import {
  Plus,
  Pencil,
  Power,
  Loader2,
  BookOpenCheck,
  RotateCcw,
} from "lucide-react";

type EditorState = {
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
  detailFileType?: string | null;
  detailFileSize?: number | null;
};

function parseBilingualContent(rawContent: string): { vi: string; en: string } {
  const normalized = rawContent.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  const viToken = "[VI]";
  const enToken = "[EN]";
  const viIndex = normalized.indexOf(viToken);
  const enIndex = normalized.indexOf(enToken);

  if (viIndex >= 0 && enIndex > viIndex) {
    return {
      vi: normalized.slice(viIndex + viToken.length, enIndex).trim(),
      en: normalized.slice(enIndex + enToken.length).trim(),
    };
  }

  if (enIndex >= 0) {
    const english = normalized.slice(enIndex + enToken.length).trim();
    return { vi: english, en: english };
  }

  return { vi: normalized, en: normalized };
}

function composeBilingualContent(vi: string, en: string): string {
  return `[VI]\n${vi.trim()}\n\n[EN]\n${en.trim()}`;
}

function parseInlineBilingual(raw: string): { vi: string; en: string } {
  const normalized = raw.trim();
  const separator = " / ";
  const idx = normalized.indexOf(separator);
  if (idx < 0) {
    return { vi: normalized, en: normalized };
  }

  const vi = normalized.slice(0, idx).trim();
  const en = normalized.slice(idx + separator.length).trim();
  return {
    vi: vi || normalized,
    en: en || vi || normalized,
  };
}

function toEditorState(module?: OnboardingModuleResponse): EditorState {
  if (!module) {
    return {
      title: "",
      summary: "",
      displayOrder: 1,
      estimatedMinutes: 10,
      requiredPermissions: [],
      contentVi: "",
      contentEn: "",
      isActive: true,
      detailFileName: null,
      detailFileType: null,
      detailFileSize: null,
    };
  }

  const parsed = parseBilingualContent(module.content);
  return {
    id: module.id,
    title: module.title,
    summary: module.summary ?? "",
    displayOrder: module.displayOrder,
    estimatedMinutes: module.estimatedMinutes,
    requiredPermissions: [...module.requiredPermissions],
    contentVi: parsed.vi,
    contentEn: parsed.en,
    isActive: module.isActive,
    detailFileName: module.detailFileName ?? null,
    detailFileType: module.detailFileType ?? null,
    detailFileSize: module.detailFileSize ?? null,
  };
}

export default function StaffOnboardingPage() {
  const { language } = useLanguageStore();
  const isEn = language === "en";

  const text = useMemo(
    () => ({
      title: isEn ? "Staff Onboarding Content Center" : "Trung tâm nội dung onboarding (Staff)",
      subtitle: isEn
        ? "Staff manages shared onboarding content for all tenants."
        : "Staff quản lý bộ onboarding dùng chung cho tất cả tenant.",
      createModule: isEn ? "Create module" : "Tạo module mới",
      totalModules: isEn ? "Total modules" : "Tổng module",
      activeModules: isEn ? "Active modules" : "Module hoạt động",
      inactiveModules: isEn ? "Inactive modules" : "Module tạm ẩn",
      loadingModules: isEn ? "Loading onboarding modules..." : "Đang tải module onboarding...",
      noModules: isEn ? "No onboarding modules available yet." : "Chưa có module onboarding nào.",
      edit: isEn ? "Edit" : "Sửa",
      deactivate: isEn ? "Deactivate" : "Vô hiệu hóa",
      reactivate: isEn ? "Reactivate" : "Kích hoạt lại",
      active: isEn ? "Active" : "Đang hoạt động",
      inactive: isEn ? "Inactive" : "Tạm ẩn",
      requiredPermissions: isEn ? "Required permissions" : "Quyền yêu cầu",
      detailFile: isEn ? "Detail file" : "File chi tiết",
      minutes: isEn ? "min" : "phút",
      editorCreateTitle: isEn ? "Create onboarding module" : "Tạo module onboarding",
      editorUpdateTitle: isEn ? "Update onboarding module" : "Cập nhật module onboarding",
      editorHint: isEn
        ? "Content is rendered based on each user's language setting."
        : "Nội dung hiển thị theo ngôn ngữ của từng người dùng.",
      sectionBasics: isEn ? "Basic information" : "Thông tin cơ bản",
      sectionPermissions: isEn ? "Access requirements" : "Quyền truy cập",
      sectionPermissionsHint: isEn
        ? "Users must have all selected permissions to open this module."
        : "Người dùng cần đủ các quyền đã chọn để mở module này.",
      sectionFile: isEn ? "Attachment" : "File đính kèm",
      sectionContent: isEn ? "Bilingual content" : "Nội dung song ngữ",
      formTitle: isEn ? "Title" : "Tiêu đề",
      formSummary: isEn ? "Summary" : "Tóm tắt",
      formDisplayOrder: isEn ? "Display order" : "Thứ tự hiển thị",
      formEstimatedMinutes: isEn ? "Estimated minutes" : "Thời lượng (phút)",
      formActive: isEn ? "Active" : "Hoạt động",
      loadingPermissions: isEn ? "Loading permissions..." : "Đang tải danh sách quyền...",
      formDetailFile: isEn ? "Detail file (.txt or .pdf)" : "File chi tiết module (.txt hoặc .pdf)",
      formCurrentFile: isEn ? "Current file" : "File hiện tại",
      formWillUpload: isEn ? "Will upload on save" : "Sẽ tải lên khi lưu",
      contentVi: isEn ? "Vietnamese content" : "Nội dung tiếng Việt",
      contentEn: isEn ? "English content" : "Nội dung tiếng Anh",
      cancel: isEn ? "Cancel" : "Hủy",
      saveChanges: isEn ? "Save changes" : "Lưu thay đổi",
      createNow: isEn ? "Create module" : "Tạo module",
      confirmDeactivateTitle: isEn ? "Confirm deactivation" : "Xác nhận vô hiệu hóa module",
      confirmDeactivateBody: isEn
        ? "Are you sure you want to deactivate this module?"
        : "Bạn có chắc muốn vô hiệu hóa module này?",
      confirmDeactivate: isEn ? "Confirm deactivation" : "Xác nhận vô hiệu hóa",
      emptyTitleContent: isEn
        ? "Title and content must not be empty."
        : "Tiêu đề và nội dung không được để trống.",
      txtPdfOnly: isEn
        ? "Only .txt or .pdf detail files are supported."
        : "Chỉ hỗ trợ file chi tiết .txt hoặc .pdf.",
      max10mb: isEn ? "Detail file size must be <= 10MB." : "File chi tiết không được vượt quá 10MB.",
      saveFailed: isEn ? "Failed to save onboarding module" : "Không lưu được module onboarding",
      deactivateFailed: isEn ? "Failed to deactivate module" : "Không thể vô hiệu hóa module",
      reactivateFailed: isEn ? "Failed to reactivate module" : "Không thể kích hoạt lại module",
      loadModulesFailed: isEn ? "Failed to load onboarding modules" : "Không tải được module onboarding",
      deactivatedNotice: isEn ? "Module deactivated" : "Đã vô hiệu hóa module",
    }),
    [isEn]
  );

  const [modules, setModules] = useState<OnboardingModuleResponse[]>([]);
  const [permissionCategories, setPermissionCategories] = useState<PermissionCategoryDto[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorState, setEditorState] = useState<EditorState>(toEditorState());
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] =
    useState<OnboardingModuleResponse | null>(null);

  const activeCount = useMemo(
    () => modules.filter((item) => item.isActive).length,
    [modules]
  );

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStaffOnboardingModules(true);
      setModules([...data].sort((a, b) => a.displayOrder - b.displayOrder));
    } catch {
      setError(text.loadModulesFailed);
    } finally {
      setLoading(false);
    }
  }, [text.loadModulesFailed]);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  useEffect(() => {
    let cancelled = false;
    setPermissionsLoading(true);
    getStaffOnboardingAvailablePermissions()
      .then((data) => {
        if (!cancelled) setPermissionCategories(resolveTenantPermissionCategories(data));
      })
      .catch(() => {
        if (!cancelled) setPermissionCategories(resolveTenantPermissionCategories([]));
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const permissionLabelMap = useMemo(
    () => buildPermissionLabelMap(
      permissionCategories.flatMap((category) =>
        (category.permissions ?? []).map((permission) => ({
          code: permission.code,
          nameEn: permission.name,
          nameVi: permission.description,
        }))
      )
    ),
    [permissionCategories]
  );

  const formatPermission = useCallback(
    (code: string) =>
      getPermissionLabel(code, permissionLabelMap.get(code), isEn ? "en" : "vi"),
    [permissionLabelMap, isEn]
  );

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error]);

  useEffect(() => {
    if (!notice) return;
    toast.info(notice);
    setNotice(null);
  }, [notice]);

  const openCreate = () => {
    setEditorState(toEditorState());
    setAttachmentFile(null);
    setEditorOpen(true);
  };

  const openEdit = (module: OnboardingModuleResponse) => {
    setEditorState(toEditorState(module));
    setAttachmentFile(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorState(toEditorState());
    setAttachmentFile(null);
  };

  const submitEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payloadBase: UpdateOnboardingModuleRequest = {
        title: editorState.title.trim(),
        summary: editorState.summary.trim() || undefined,
        displayOrder: Number(editorState.displayOrder),
        estimatedMinutes: Number(editorState.estimatedMinutes),
        requiredPermissions: editorState.requiredPermissions,
        content: composeBilingualContent(editorState.contentVi, editorState.contentEn),
        isActive: editorState.isActive,
      };

      if (!payloadBase.title || !payloadBase.content) {
        throw new Error(text.emptyTitleContent);
      }

      let savedModule: OnboardingModuleResponse;

      if (!editorState.id) {
        savedModule = await createStaffOnboardingModule({
          title: payloadBase.title,
          summary: payloadBase.summary,
          displayOrder: payloadBase.displayOrder,
          estimatedMinutes: payloadBase.estimatedMinutes,
          requiredPermissions: payloadBase.requiredPermissions,
          content: payloadBase.content,
        });
      } else {
        savedModule = await updateStaffOnboardingModule(editorState.id, payloadBase);
      }

      if (attachmentFile) {
        const normalizedName = attachmentFile.name.toLowerCase();
        if (!normalizedName.endsWith(".txt") && !normalizedName.endsWith(".pdf")) {
          throw new Error(text.txtPdfOnly);
        }
        if (attachmentFile.size > 10 * 1024 * 1024) {
          throw new Error(text.max10mb);
        }

        await uploadStaffOnboardingModuleAttachment(savedModule.id, attachmentFile);
      }

      closeEditor();
      await loadModules();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const deactivateModule = (module: OnboardingModuleResponse) => {
    setDeactivateTarget(module);
    setDeactivateModalOpen(true);
  };

  const confirmDeactivateModule = async () => {
    if (!deactivateTarget) return;

    setSaving(true);
    try {
      await deactivateStaffOnboardingModule(deactivateTarget.id);
      setNotice(`${text.deactivatedNotice}: ${deactivateTarget.title}`);
      setDeactivateModalOpen(false);
      setDeactivateTarget(null);
      await loadModules();
    } catch {
      setError(text.deactivateFailed);
    } finally {
      setSaving(false);
    }
  };

  const reactivateModule = async (module: OnboardingModuleResponse) => {
    setSaving(true);
    try {
      await updateStaffOnboardingModule(module.id, { isActive: true });
      await loadModules();
    } catch {
      setError(text.reactivateFailed);
    } finally {
      setSaving(false);
    }
  };

  const titleForDisplay = (raw: string) => {
    const parsed = parseInlineBilingual(raw);
    return isEn ? parsed.en : parsed.vi;
  };

  const summaryForDisplay = (raw?: string | null) => {
    if (!raw) return "";
    const parsed = parseInlineBilingual(raw);
    return isEn ? parsed.en : parsed.vi;
  };

  const editorLabels: OnboardingEditorLabels = useMemo(
    () => ({
      createTitle: text.editorCreateTitle,
      updateTitle: text.editorUpdateTitle,
      hint: text.editorHint,
      formTitle: text.formTitle,
      formSummary: text.formSummary,
      formDisplayOrder: text.formDisplayOrder,
      formEstimatedMinutes: text.formEstimatedMinutes,
      formActive: text.formActive,
      sectionBasics: text.sectionBasics,
      sectionPermissions: text.sectionPermissions,
      sectionPermissionsHint: text.sectionPermissionsHint,
      sectionFile: text.sectionFile,
      sectionContent: text.sectionContent,
      loadingPermissions: text.loadingPermissions,
      formDetailFile: text.formDetailFile,
      formCurrentFile: text.formCurrentFile,
      formWillUpload: text.formWillUpload,
      contentVi: text.contentVi,
      contentEn: text.contentEn,
      cancel: text.cancel,
      saveChanges: text.saveChanges,
      createNow: text.createNow,
    }),
    [text]
  );

  const handleAttachmentChange = (file: File | null) => {
    if (!file) {
      setAttachmentFile(null);
      return;
    }
    const normalizedName = file.name.toLowerCase();
    if (!normalizedName.endsWith(".txt") && !normalizedName.endsWith(".pdf")) {
      setError(text.txtPdfOnly);
      setAttachmentFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(text.max10mb);
      setAttachmentFile(null);
      return;
    }
    setAttachmentFile(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{text.title}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{text.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {text.createModule}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cn(dashboardPanelClass, "p-4 sm:p-5")}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{text.totalModules}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{modules.length}</p>
        </div>
        <div className={cn(dashboardPanelClass, "p-4 sm:p-5")}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{text.activeModules}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
        </div>
        <div className={cn(dashboardPanelClass, "p-4 sm:p-5")}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{text.inactiveModules}</p>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{modules.length - activeCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-600 dark:text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            {text.loadingModules}
          </div>
        ) : modules.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{text.noModules}</div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {modules.map((module) => (
              <article key={module.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-zinc-100 px-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {module.displayOrder}
                      </span>
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {titleForDisplay(module.title)}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          module.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                      >
                        {module.isActive ? text.active : text.inactive}
                      </span>
                    </div>
                    {module.summary && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{summaryForDisplay(module.summary)}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <BookOpenCheck className="h-3.5 w-3.5" />
                        ~{module.estimatedMinutes} {text.minutes}
                      </span>
                      {module.detailFileName && (
                        <span>
                          {text.detailFile}: {module.detailFileName} ({module.detailFileType === "application/pdf" ? "PDF" : "TXT"})
                        </span>
                      )}
                      {module.requiredPermissions.length > 0 && (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <span>{text.requiredPermissions}:</span>
                          {module.requiredPermissions.map((permission) => (
                            <span
                              key={permission}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {formatPermission(permission)}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(module)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {text.edit}
                    </button>

                    {module.isActive ? (
                      <button
                        type="button"
                        onClick={() => deactivateModule(module)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {text.deactivate}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void reactivateModule(module)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {text.reactivate}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <OnboardingModuleEditorModal
        open={editorOpen}
        saving={saving}
        labels={editorLabels}
        state={editorState}
        onChange={(patch) => setEditorState((prev) => ({ ...prev, ...patch }))}
        permissionCategories={permissionCategories}
        permissionsLoading={permissionsLoading}
        attachmentFile={attachmentFile}
        onAttachmentChange={handleAttachmentChange}
        onClose={closeEditor}
        onSubmit={submitEditor}
      />

      {deactivateModalOpen && deactivateTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
          <div
            className="absolute inset-0"
            onClick={() => {
              if (!saving) {
                setDeactivateModalOpen(false);
                setDeactivateTarget(null);
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{text.confirmDeactivateTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {text.confirmDeactivateBody}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100"> {titleForDisplay(deactivateTarget.title)}</span>
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!saving) {
                    setDeactivateModalOpen(false);
                    setDeactivateTarget(null);
                  }
                }}
                disabled={saving}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeactivateModule()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {text.confirmDeactivate}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
