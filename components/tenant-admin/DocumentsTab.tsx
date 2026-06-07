"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, useConfirmDialog } from "@/components/ui";
import {
  listDocuments,
  listDeletedDocuments,
  getDocument,
  getDocumentPreview,
  getVersionHistory,
  uploadDocument,
  uploadNewVersion,
  updateDocumentAccess,
  softDeleteDocument,
  restoreDocument,
  downloadDocument,
  reindexDocument,
  listAccessScopeDepartments,
  listAccessScopeRoles,
  type UploadDocumentParams,
  type DocumentPreviewResponse,
  type ListDocumentsParams,
} from "@/lib/api/documents";
import { documentUploadAccessHint } from "@/lib/role-levels";
import type {
  DocumentResponse,
  DeletedDocumentResponse,
  DocumentVersionResponse,
  DocumentVisibility,
  UpdateDocumentAccessRequest,
} from "@/types/knowledge";
import { getStoredUser } from "@/lib/auth-store";
import { listCategoriesFlat } from "@/lib/api/categories";
import { listTagsActive } from "@/lib/api/tags";
import type { DocumentCategoryResponse, DocumentTagResponse } from "@/types/knowledge";
import { type DepartmentResponse, type RoleResponse } from "@/lib/api/tenant-admin";
import {
  Upload,
  Download,
  Trash2,
  RotateCcw,
  Lock,
  Eye,
  FileText,
  History,
  X,
  ChevronDown,
  Check,
  Calendar,
  Files,
  ShieldCheck,
  Loader2,
  CircleCheckBig,
  CircleAlert,
  Cpu,
  MoreVertical,
} from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";

const DOCUMENT_LIMIT_ERROR_KEYWORD = "giới hạn số lượng tài liệu";
const DOCUMENT_LIMIT_WARNING_MESSAGE =
  "Bạn đã đạt giới hạn tài liệu theo gói hiện tại. Vui lòng liên hệ quản trị để nâng cấp.";

function normalizeErrorText(value: string): string {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsMessage(source: string, keyword: string): boolean {
  return normalizeErrorText(source).includes(normalizeErrorText(keyword));
}

function isDocumentLimitWarning(message: string): boolean {
  return (
    containsMessage(message, DOCUMENT_LIMIT_ERROR_KEYWORD) ||
    message === DOCUMENT_LIMIT_WARNING_MESSAGE
  );
}

/**
 * Khi scope theo role: ngưỡng phân cấp trên tài liệu lấy theo **mức cao nhất (số lớn nhất 1–5)**
 * trong các role được chọn — khớp ý “chỉ tick Employee (level 4) thì không cần chọn lại level tay”.
 */
function deriveMinimumRoleLevelFromSelectedRoles(
  selectedRoleIds: number[],
  allRoles: RoleResponse[]
): number {
  const levels = selectedRoleIds
    .map((id) => allRoles.find((r) => r.id === id)?.level)
    .filter((lv): lv is number => typeof lv === "number" && Number.isFinite(lv) && lv >= 1 && lv <= 5);
  if (levels.length === 0) return 4;
  return Math.max(...levels);
}

function visibilityUsesRoleScope(visibility: DocumentVisibility): boolean {
  return visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES";
}

function getVisibilityLabels(language: "vi" | "en"): Record<DocumentVisibility, string> {
  if (language === "en") {
    return {
      COMPANY_WIDE: "Company-wide",
      SPECIFIC_DEPARTMENTS: "Specific departments",
      SPECIFIC_ROLES: "Specific roles",
      SPECIFIC_DEPARTMENTS_AND_ROLES: "Specific departments AND roles",
    };
  }

  return {
    COMPANY_WIDE: "Toàn công ty",
    SPECIFIC_DEPARTMENTS: "Theo phòng ban",
    SPECIFIC_ROLES: "Theo vai trò",
    SPECIFIC_DEPARTMENTS_AND_ROLES: "Theo phòng ban và vai trò",
  };
}

function prettifyDocumentAccessError(message: string, language: "vi" | "en"): string {
  const lower = message.toLowerCase();
  if (lower.includes("visibility_enum") && lower.includes("does not exist")) {
    return language === "en"
      ? "Cannot update document access because the backend schema is out of sync (missing visibility enum). Please check backend migrations/schema."
      : "Không thể cập nhật quyền truy cập do máy chủ chưa đồng bộ lược đồ cơ sở dữ liệu (thiếu kiểu visibility). Vui lòng kiểm tra migration/lược đồ phía máy chủ.";
  }
  return message;
}

function mapEmbeddingStatusLabel(
  raw: string | undefined,
  t: (typeof translations)["vi"]
): string {
  const key = (raw ?? "").trim().toUpperCase();
  switch (key) {
    case "COMPLETED":
      return t.statusCompleted;
    case "PENDING":
    case "DOCUMENTS AWAITING PROCESSING":
      return t.statusPending;
    case "PROCESSING":
      return t.statusProcessing;
    case "FAILED":
      return t.statusFailed;
    default:
      return raw?.trim() || "—";
  }
}

type EmbeddingState = "completed" | "in-progress" | "failed" | "unknown";

function getEmbeddingState(raw: string | undefined): EmbeddingState {
  const key = (raw ?? "").trim().toUpperCase();
  if (!key) return "unknown";
  if (key === "COMPLETED" || key.includes("SUCCESS") || key.includes("READY")) {
    return "completed";
  }
  if (key === "FAILED" || key.includes("ERROR") || key.includes("FAIL")) {
    return "failed";
  }
  if (
    key === "PENDING" ||
    key === "PROCESSING" ||
    key.includes("PEND") ||
    key.includes("PROCESS") ||
    key.includes("QUEUE") ||
    key.includes("AWAIT")
  ) {
    return "in-progress";
  }
  return "unknown";
}

function extractCompletionTimestamp(doc: DocumentResponse): string | null {
  const raw = doc as unknown as Record<string, unknown>;
  const candidates = [
    raw.embeddingCompletedAt,
    raw.embeddingUpdatedAt,
    raw.completedAt,
    raw.lastEmbeddedAt,
    raw.updatedAt,
  ];
  for (const c of candidates) {
    if (typeof c !== "string" || c.trim().length === 0) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function getUploaderDisplayName(doc: DocumentResponse): string {
  return (
    doc.uploadedByName ??
    doc.uploadedByEmail ??
    doc.uploadedBy ??
    "—"
  );
}

type DocumentAction = "viewDetail" | "download" | "edit" | "delete" | "changeScope";

function canPerformDocumentAction(params: {
  action: DocumentAction;
  isTenantAdmin: boolean;
  isOwner: boolean;
  canEditDocuments: boolean;
}): boolean {
  const { action, isTenantAdmin, isOwner, canEditDocuments } = params;
  if (action === "viewDetail" || action === "download") return true;
  if (!canEditDocuments) return false;
  if (isTenantAdmin) return true;
  return isOwner;
}

function isSpreadsheetFile(fileType?: string | null, originalFileName?: string | null): boolean {
  const normalizedType = (fileType ?? "").toLowerCase();
  const normalizedName = (originalFileName ?? "").toLowerCase();
  return (
    normalizedType.includes("spreadsheet") ||
    normalizedType.includes("excel") ||
    normalizedType.includes("officedocument.spreadsheetml") ||
    normalizedName.endsWith(".xls") ||
    normalizedName.endsWith(".xlsx")
  );
}

export function DocumentsTab({ mode = "all", hideEditActions = false }: { mode?: "all" | "upload" | "library"; hideEditActions?: boolean }) {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [deleted, setDeleted] = useState<DeletedDocumentResponse[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryResponse[]>([]);
  const [tags, setTags] = useState<DocumentTagResponse[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [uploadVisibility, setUploadVisibility] = useState<DocumentVisibility>("COMPANY_WIDE");
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  /** Ngưỡng phân cấp 1–5 khi upload (minimumRoleLevel trên BE) */
  const [uploadMinimumRoleLevel, setUploadMinimumRoleLevel] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [accessDoc, setAccessDoc] = useState<DocumentResponse | null>(null);
  const [versionDocId, setVersionDocId] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [newVersionDocId, setNewVersionDocId] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocumentResponse | null>(null);
  const [detailPreview, setDetailPreview] = useState<DocumentPreviewResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVersions, setDetailVersions] = useState<DocumentVersionResponse[]>([]);
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [embeddingTrackDocId, setEmbeddingTrackDocId] = useState<string | null>(null);
  const [embeddingTrackFileName, setEmbeddingTrackFileName] = useState<string>("");
  const [embeddingTrackStatus, setEmbeddingTrackStatus] = useState<string>("PENDING");
  const [embeddingProgress, setEmbeddingProgress] = useState(10);
  const [embeddingCompletedAtByDocId, setEmbeddingCompletedAtByDocId] = useState<Record<string, string>>({});
  const previousEmbeddingStateRef = useRef<Record<string, EmbeddingState>>({});
  
  // Menu states
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const canEditDocuments = !hideEditActions;
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id ?? null;
  const isTenantAdminUser = useMemo(
    () => (currentUser?.roles ?? []).some((role) => role.toUpperCase().includes("TENANT_ADMIN")),
    [currentUser?.roles]
  );

  const isDocumentOwner = useCallback(
    (doc: DocumentResponse | undefined | null) => {
      if (!doc) return false;
      if (!currentUserId) return false;
      return (doc.uploadedBy ?? "").trim().toLowerCase() === currentUserId.trim().toLowerCase();
    },
    [currentUserId]
  );

  const canManageDocument = useCallback(
    (doc: DocumentResponse | undefined | null) => {
      if (!doc) return false;
      return canPerformDocumentAction({
        action: "edit",
        isTenantAdmin: isTenantAdminUser,
        isOwner: isDocumentOwner(doc),
        canEditDocuments,
      });
    },
    [canEditDocuments, isDocumentOwner, isTenantAdminUser]
  );
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [reindexing, setReindexing] = useState<Record<string, boolean>>({});
  
  // Search and filter states
  const [searchKeywordInput, setSearchKeywordInput] = useState<string>("");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Use refs to store current filter values for API calls without causing re-renders
  const currentFiltersRef = useRef({
    searchKeyword: "",
    filterCategoryId: "",
    filterTagIds: [] as string[],
    filterStatus: "",
    filterFromDate: "",
    filterToDate: "",
  });
  
  // Update ref whenever filters change
  useEffect(() => {
    currentFiltersRef.current = {
      searchKeyword,
      filterCategoryId,
      filterTagIds,
      filterStatus,
      filterFromDate,
      filterToDate,
    };
  }, [searchKeyword, filterCategoryId, filterTagIds, filterStatus, filterFromDate, filterToDate]);

  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  const shouldLoadLibrary = mode === "all" || mode === "library";
  const visibilityLabels = getVisibilityLabels(language);
  const { confirm, confirmDialog } = useConfirmDialog();

  const updateEmbeddingCompletionTimestamps = useCallback((nextDocs: DocumentResponse[]) => {
    setEmbeddingCompletedAtByDocId((prev) => {
      const next = { ...prev };
      const seen = new Set<string>();

      for (const doc of nextDocs) {
        seen.add(doc.id);
        const state = getEmbeddingState(doc.embeddingStatus);
        const prevState = previousEmbeddingStateRef.current[doc.id];
        const serverTimestamp = extractCompletionTimestamp(doc);

        if (state === "completed") {
          if (serverTimestamp) {
            next[doc.id] = serverTimestamp;
          } else if (prevState && prevState !== "completed") {
            next[doc.id] = new Date().toISOString();
          } else if (!next[doc.id]) {
            next[doc.id] = doc.uploadedAt;
          }
        }

        if (state !== "completed" && prevState === "completed") {
          delete next[doc.id];
        }

        previousEmbeddingStateRef.current[doc.id] = state;
      }

      for (const id of Object.keys(next)) {
        if (!seen.has(id)) delete next[id];
      }

      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = currentFiltersRef.current;
      const params: ListDocumentsParams = {};
      if (filters.searchKeyword.trim()) params.keyword = filters.searchKeyword.trim();
      if (filters.filterCategoryId) params.categoryId = filters.filterCategoryId;
      if (filters.filterTagIds.length > 0) params.tagIds = filters.filterTagIds;
      if (filters.filterStatus) params.status = filters.filterStatus;
      // Convert date to LocalDateTime format (ISO 8601 with time)
      if (filters.filterFromDate) params.fromDate = `${filters.filterFromDate}T00:00:00`;
      if (filters.filterToDate) params.toDate = `${filters.filterToDate}T23:59:59`;
      const docsPromise: Promise<DocumentResponse[]> = shouldLoadLibrary
        ? listDocuments(params)
        : Promise.resolve([]);
      const deletedPromise: Promise<DeletedDocumentResponse[]> = shouldLoadLibrary
        ? listDeletedDocuments()
        : Promise.resolve([]);

      const [docs, cats, activeTags, depts, tenantRoles, del] = await Promise.all([
        docsPromise,
        listCategoriesFlat(),
        listTagsActive(),
        listAccessScopeDepartments().catch(() => []),
        listAccessScopeRoles().catch(() => []),
        deletedPromise,
      ]);

      if (shouldLoadLibrary) {
        setDocuments(docs);
        updateEmbeddingCompletionTimestamps(docs);
      } else {
        setDocuments([]);
        updateEmbeddingCompletionTimestamps([]);
      }

      setCategories(cats);
      setTags(activeTags);
      setDepartments(depts);
      setRoles(tenantRoles);

      if (shouldLoadLibrary) {
        setDeleted(del);
      } else {
        setDeleted([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to load data" : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [updateEmbeddingCompletionTimestamps, isEn, shouldLoadLibrary]);

  const applySearchKeyword = useCallback(() => {
    const nextKeyword = searchKeywordInput.trim();
    setSearchKeyword(nextKeyword);
    currentFiltersRef.current = {
      ...currentFiltersRef.current,
      searchKeyword: nextKeyword,
    };
    void load();
  }, [searchKeywordInput, load]);

  const isWarningError = !!error && isDocumentLimitWarning(error);

  useEffect(() => {
    void load();
  }, [load]);

  // Create stable tracking key for in-progress documents
  const inProgressTrackingKey = useMemo(() => {
    return documents
      .filter((doc) => {
        const state = getEmbeddingState(doc.embeddingStatus);
        return state === "in-progress";
      })
      .map((doc) => doc.id)
      .sort()
      .join(",");
  }, [documents]);

  // Lightweight polling: only update status of in-progress documents
  useEffect(() => {
    // If no documents are in progress, don't poll
    if (!inProgressTrackingKey) return;

    const inProgressDocIds = inProgressTrackingKey.split(",").filter(Boolean);

    // Poll every 5 seconds (less disruptive)
    const interval = setInterval(async () => {
      try {
        // Fetch all in-progress documents in parallel with proper error handling
        const promises = inProgressDocIds.map(async (docId) => {
          try {
            return await getDocument(docId);
          } catch (err) {
            // Silently ignore documents that can't be fetched (deleted, permission changed, etc.)
            return null;
          }
        });

        const results = await Promise.all(promises);

        // Batch update all documents at once
        const updates: Record<string, string> = {};
        const completedTimestamps: Record<string, string> = {};

        results.forEach((updatedDoc) => {
          if (!updatedDoc) return;

          updates[updatedDoc.id] = updatedDoc.embeddingStatus || "UNKNOWN";

          // Track completion timestamps
          const newState = getEmbeddingState(updatedDoc.embeddingStatus);
          if (newState === "completed") {
            const serverTimestamp = extractCompletionTimestamp(updatedDoc);
            if (serverTimestamp) {
              completedTimestamps[updatedDoc.id] = serverTimestamp;
            }
            previousEmbeddingStateRef.current[updatedDoc.id] = "completed";
          }
        });

        // Single state update to minimize re-renders
        if (Object.keys(updates).length > 0) {
          setDocuments((prevDocs) =>
            prevDocs.map((doc) =>
              updates[doc.id]
                ? { ...doc, embeddingStatus: updates[doc.id] }
                : doc
            )
          );
        }

        if (Object.keys(completedTimestamps).length > 0) {
          setEmbeddingCompletedAtByDocId((prev) => ({
            ...prev,
            ...completedTimestamps,
          }));
        }
      } catch (e) {
        // Silently fail - don't disrupt user experience
        console.error("Failed to poll document status:", e);
      }
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [inProgressTrackingKey]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement)?.files?.[0];
    if (!file) {
      setError(isEn ? "Please select a file to upload" : "Chọn tệp để tải lên");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const categoryId = (form.elements.namedItem("categoryId") as HTMLSelectElement)?.value || undefined;
      const tagIds = selectedTagIds;
      const description = (form.elements.namedItem("description") as HTMLInputElement)?.value || undefined;
      const visibility = uploadVisibility;
      const accessibleDepartments =
        visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES"
          ? selectedDepartmentIds
          : null;
      const accessibleRoles =
        visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES"
          ? selectedRoleIds
          : null;

      if (
        (visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") &&
        selectedDepartmentIds.length === 0
      ) {
        setError(isEn ? "Please select at least one department." : "Vui lòng chọn ít nhất 1 phòng ban.");
        setUploading(false);
        return;
      }
      if (
        (visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") &&
        selectedRoleIds.length === 0
      ) {
        setError(isEn ? "Please select at least one role." : "Vui lòng chọn ít nhất 1 vai trò.");
        setUploading(false);
        return;
      }
      const resolvedMinimumRoleLevel = visibilityUsesRoleScope(visibility)
        ? deriveMinimumRoleLevelFromSelectedRoles(selectedRoleIds, roles)
        : uploadMinimumRoleLevel;
      const params: UploadDocumentParams = {
        file,
        categoryId: categoryId || null,
        tagIds: tagIds.length ? tagIds : null,
        description: description || null,
        minimumRoleLevel: resolvedMinimumRoleLevel,
        visibility: visibility || "COMPANY_WIDE",
        accessibleDepartments,
        accessibleRoles,
      };
      const uploadedDoc = await uploadDocument(params);
      form.reset();
      setSelectedTagIds([]);
      setUploadVisibility("COMPANY_WIDE");
      setSelectedDepartmentIds([]);
      setSelectedRoleIds([]);
      setUploadMinimumRoleLevel(4);
      setEmbeddingTrackDocId(uploadedDoc.id);
      setEmbeddingTrackFileName(uploadedDoc.originalFileName || uploadedDoc.documentTitle || file.name);
      setEmbeddingTrackStatus(uploadedDoc.embeddingStatus || "PENDING");
      setEmbeddingProgress(12);
      setEmbeddingModalOpen(true);
      await load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : isEn ? "Upload failed" : "Tải lên thất bại";
      if (containsMessage(raw, DOCUMENT_LIMIT_ERROR_KEYWORD)) {
        setError(DOCUMENT_LIMIT_WARNING_MESSAGE);
      } else {
        setError(raw);
      }
    } finally {
      setUploading(false);
    }
  };

  const mapStatusToTargetProgress = (raw: string | undefined): number => {
    const state = getEmbeddingState(raw);
    if (state === "completed") return 100;
    if (state === "failed") return 100;
    if (state === "in-progress") return 72;
    return 26;
  };

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => {
      setOpenMenuId(null);
      setMenuPos(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!embeddingModalOpen) return;
    const target = mapStatusToTargetProgress(embeddingTrackStatus);
    if (embeddingProgress >= target) return;

    const tick = window.setInterval(() => {
      setEmbeddingProgress((prev) => {
        if (prev >= target) return prev;
        const step = target >= 90 ? 1 : 2;
        return Math.min(target, prev + step);
      });
    }, 70);

    return () => window.clearInterval(tick);
  }, [embeddingModalOpen, embeddingTrackStatus, embeddingProgress]);

  // Poll embedding status for the tracked document when modal is open
  useEffect(() => {
    if (!embeddingModalOpen || !embeddingTrackDocId) return;
    
    const state = getEmbeddingState(embeddingTrackStatus);
    if (state === "completed" || state === "failed") return;

    // Poll every 2 seconds when modal is open
    const interval = setInterval(async () => {
      try {
        const doc = await getDocument(embeddingTrackDocId);
        setEmbeddingTrackStatus(doc.embeddingStatus || "PENDING");
        
        // If completed or failed, stop polling and refresh the main list
        const newState = getEmbeddingState(doc.embeddingStatus);
        if (newState === "completed" || newState === "failed") {
          await load();
        }
      } catch (e) {
        // Silently fail - modal will continue with existing status
        console.error("Failed to poll embedding status:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [embeddingModalOpen, embeddingTrackDocId, embeddingTrackStatus, load]);

  const handleUpdateAccess = async (id: string, body: UpdateDocumentAccessRequest) => {
    setError(null);
    try {
      await updateDocumentAccess(id, body);
      setAccessDoc(null);
      await load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : isEn ? "Update failed" : "Cập nhật thất bại";
      setError(prettifyDocumentAccessError(raw, language));
    }
  };

  const handleSoftDelete = async (id: string) => {
    const ok = await confirm({
      title: isEn ? "Soft delete this document?" : "Xóa mềm tài liệu?",
      description: isEn
        ? "You can restore this document from deleted documents list."
        : "Bạn có thể khôi phục tài liệu từ thùng rác.",
      confirmText: t.softDelete,
      cancelText: t.cancel,
      tone: "warning",
    });
    if (!ok) return;

    setError(null);
    try {
      await softDeleteDocument(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Delete failed" : "Xóa thất bại");
    }
  };

  const handleRestore = async (id: string) => {
    setError(null);
    try {
      await restoreDocument(id);
      setShowDeleted(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Restore failed" : "Khôi phục thất bại");
    }
  };

  const loadVersions = async (id: string) => {
    setVersionDocId(id);
    try {
      const v = await getVersionHistory(id);
      setVersions(v);
      setSelectedVersionId(v?.[0]?.versionId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to load version history" : "Không tải được lịch sử phiên bản");
      setVersions([]);
      setSelectedVersionId(null);
    }
  };

  const handleUploadNewVersion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newVersionDocId) return;
    const form = e.currentTarget;
    const file = (form.elements.namedItem("versionFile") as HTMLInputElement)?.files?.[0];
    if (!file) {
      setError(isEn ? "Please select a new version file" : "Chọn file phiên bản mới");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const versionNote = (form.elements.namedItem("versionNote") as HTMLInputElement)?.value || undefined;
      await uploadNewVersion({ documentId: newVersionDocId, file, versionNote });
      setNewVersionDocId(null);
      form.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Version upload failed" : "Tải lên phiên bản thất bại");
    } finally {
      setUploading(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setDetailLoading(true);
    setError(null);
    try {
      const [doc, preview, versionHistory] = await Promise.all([
        getDocument(id),
        getDocumentPreview(id),
        getVersionHistory(id).catch(() => []),
      ]);
      setDetailDoc(doc);
      setDetailPreview(preview);
      setDetailVersions(versionHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to load document details" : "Không tải được chi tiết tài liệu");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setError(null);
    try {
      const file = await downloadDocument(id);
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename ?? fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to download document" : "Không tải được tài liệu");
    }
  };

  const handleReindex = async (id: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setError(null);
    setReindexing((prev) => ({ ...prev, [id]: true }));
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, embeddingStatus: "PENDING" } : doc))
    );
    setEmbeddingCompletedAtByDocId((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    previousEmbeddingStateRef.current[id] = "in-progress";
    try {
      const response = await reindexDocument(id);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? { ...doc, embeddingStatus: response?.status || "PENDING" }
            : doc
        )
      );
      setError(null);
      // Refresh document list to show updated status
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to reindex document" : "Không thể re-index tài liệu");
    } finally {
      setReindexing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleMenu = (docId: string, anchor: HTMLElement) => {
    if (openMenuId === docId) {
      setOpenMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const targetDoc = documents.find((d) => d.id === docId);
    const editable = canManageDocument(targetDoc);
    const menuWidth = 208;
    // Keep the flip logic close to real rendered height.
    const menuHeight = editable ? 292 : 96;
    const margin = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, margin),
      window.innerWidth - margin - menuWidth
    );
    const menuGap = 6;
    const openDownTop = rect.bottom + menuGap;
    const openUpTop = rect.top - menuHeight - menuGap;
    const top =
      openDownTop + menuHeight > window.innerHeight - margin
        ? Math.max(margin, openUpTop)
        : openDownTop;
    setMenuPos({ top, left });
    setOpenMenuId(docId);
  };

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    const fractionDigits = value >= 10 || unit === 0 ? 0 : 1;
    return `${value.toFixed(fractionDigits)} ${units[unit]}`;
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">{isEn ? "Loading documents..." : "Đang tải danh sách tài liệu..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            isWarningError
              ? "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
              : "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200"
          }`}
        >
          {error}
        </div>
      )}

      {(mode === "all" || mode === "upload") && (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {t.uploadDocument}
        </h3>
        <p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {documentUploadAccessHint(isEn ? "en" : "vi")}
        </p>
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isEn
                ? "File (PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, max 50MB)"
                : "Tệp tin (PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, tối đa 50MB)"}
            </label>
            <input
              name="file"
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv"
              className="block w-full rounded-lg border border-zinc-300 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t.category}
            </label>
            <select
              name="categoryId"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{t.noCategory}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t.tags}
            </label>
            <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
              {tags.length === 0 ? (
                <span className="px-2 py-1 text-xs text-zinc-500">{isEn ? "No tags yet." : "Chưa có thẻ."}</span>
              ) : (
                tags.map((t) => {
                  const active = selectedTagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTagIds((prev) =>
                          prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                        );
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        active
                          ? "bg-green-500 text-white shadow-sm shadow-green-500/30"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                      title={`${t.name} (${t.code})`}
                    >
                      {t.name} ({t.code})
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t.description}
            </label>
            <input
              name="description"
              type="text"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder={isEn ? "Short description (optional)" : "Mô tả ngắn (tùy chọn)"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t.accessScope}
            </label>
            <select
              name="visibility"
              value={uploadVisibility}
              onChange={(e) => {
                const v = e.target.value as DocumentVisibility;
                setUploadVisibility(v);
                if (v !== "SPECIFIC_DEPARTMENTS" && v !== "SPECIFIC_DEPARTMENTS_AND_ROLES") setSelectedDepartmentIds([]);
                if (v !== "SPECIFIC_ROLES" && v !== "SPECIFIC_DEPARTMENTS_AND_ROLES") setSelectedRoleIds([]);
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {Object.entries(visibilityLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          
          {/* Minimum Role Level - Always visible */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isEn ? "Minimum role level (1–5)" : "Mức tối thiểu để xem (1–5)"}
              <span 
                className="cursor-help text-xs text-zinc-500" 
                title={isEn 
                  ? "Only users with level <= this value can view this document" 
                  : "Chỉ user level <= giá trị này mới xem được"}
              >
                ⓘ
              </span>
            </label>
            <select
              value={uploadMinimumRoleLevel}
              onChange={(e) => setUploadMinimumRoleLevel(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {[1, 2, 3, 4, 5].map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                  {isEn
                    ? [" — Executive", " — Management", " — Senior", " — Employee", " — Intern / External"][lv - 1]
                    : [" — Điều hành", " — Quản lý", " — Senior", " — Nhân viên", " — Thực tập / bên ngoài"][lv - 1]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {isEn
                ? "User level X only sees documents/chunks where this value >= X."
                : "User level X chỉ thấy tài liệu/chunk khi giá trị này >= X."}
            </p>
          </div>
          
          {(uploadVisibility === "SPECIFIC_DEPARTMENTS" || uploadVisibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.selectDepartments}
              </label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
                {departments.length === 0 ? (
                  <span className="px-2 py-1 text-xs text-zinc-500">{isEn ? "No active departments." : "Chưa có phòng ban đang hoạt động."}</span>
                ) : (
                  departments.map((d) => {
                    const active = selectedDepartmentIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDepartmentIds((prev) =>
                            prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                          );
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-green-500 text-white shadow-sm shadow-green-500/30"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                        title={d.name ?? String(d.id)}
                      >
                        {d.name ?? d.code ?? d.id}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t.selected}: {selectedDepartmentIds.length}
              </p>
            </div>
          )}
          {(uploadVisibility === "SPECIFIC_ROLES" || uploadVisibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.selectRoles}
              </label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
                {roles.length === 0 ? (
                  <span className="px-2 py-1 text-xs text-zinc-500">{isEn ? "No roles found." : "Chưa có vai trò."}</span>
                ) : (
                  roles.map((r) => {
                    const active = selectedRoleIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoleIds((prev) =>
                            prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                          );
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-green-500 text-white shadow-sm shadow-green-500/30"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                        title={r.name ?? r.code ?? String(r.id)}
                      >
                        {r.name ?? r.code ?? r.id}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t.selected}: {selectedRoleIds.length}
              </p>
            </div>
          )}
          {visibilityUsesRoleScope(uploadVisibility) && (
            <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/80 p-3 text-sm text-cyan-950 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100">
              <p className="font-medium">
                {isEn ? "Level from roles (no manual pick)" : "Mức lấy theo vai trò (không chọn tay)"}
              </p>
              <p className="mt-1 text-xs text-cyan-900/90 dark:text-cyan-200/90">
                {isEn
                  ? `Saved as minimum role level = ${deriveMinimumRoleLevelFromSelectedRoles(selectedRoleIds, roles)} — the highest numeric level (1–5) among selected roles. Example: only Employee (4) → 4.`
                  : `Hệ thống lưu mức tối thiểu = ${deriveMinimumRoleLevelFromSelectedRoles(selectedRoleIds, roles)} — lấy theo mức lớn nhất (1–5) trong các vai trò đã chọn. Ví dụ: chỉ Employee (4) → 4.`}
              </p>
            </div>
          )}
          
          {(uploadVisibility === "SPECIFIC_DEPARTMENTS" || uploadVisibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t.selectDepartments}
              </label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
                {departments.length === 0 ? (
                  <span className="px-2 py-1 text-xs text-zinc-500">{isEn ? "No active departments." : "Chưa có phòng ban đang hoạt động."}</span>
                ) : (
                  departments.map((d) => {
                    const active = selectedDepartmentIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDepartmentIds((prev) =>
                            prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                          );
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-green-500 text-white shadow-sm shadow-green-500/30"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                        title={d.name ?? String(d.id)}
                      >
                        {d.name ?? d.code ?? d.id}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t.selected}: {selectedDepartmentIds.length}
              </p>
            </div>
          )}
          
          <div className="sticky bottom-0 z-10 mt-2 rounded-xl border border-zinc-200 bg-white/95 p-2 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
            <Button type="submit" variant="primary" size="md" disabled={uploading} className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? t.uploading : t.upload}
            </Button>
          </div>
        </form>
      </div>
      )}

      {(mode === "all" || mode === "library") && (
        <>
          {/* Modern Search Section */}
      <div className="space-y-4">
        {/* Prominent Search Bar */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchKeywordInput}
            onChange={(e) => setSearchKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearchKeyword();
            }}
            placeholder={isEn ? "Search documents by name or content..." : "Tìm kiếm tài liệu theo tên hoặc nội dung..."}
            className="w-full rounded-xl border border-zinc-200 bg-white py-3.5 pl-11 pr-52 text-[15px] text-zinc-900 placeholder-zinc-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500 dark:focus:border-emerald-500"
          />
          <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
            <button
              type="button"
              onClick={applySearchKeyword}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {isEn ? "Search" : "Tìm"}
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                showFilters || filterCategoryId || filterTagIds.length > 0 || filterStatus || filterFromDate || filterToDate
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {isEn ? "Filters" : "Bộ lọc"}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showFilters && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {isEn ? "Advanced Filters" : "Bộ lọc nâng cao"}
              </h3>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.category}
                </label>
                <select
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">{isEn ? "All" : "Tất cả"}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {isEn ? "Status" : "Trạng thái"}
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">{isEn ? "All" : "Tất cả"}</option>
                  <option value="COMPLETED">{t.statusCompleted}</option>
                  <option value="PENDING">{t.statusPending}</option>
                  <option value="PROCESSING">{t.statusProcessing}</option>
                  <option value="FAILED">{t.statusFailed}</option>
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {isEn ? "From" : "Từ ngày"}
                </label>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {isEn ? "To" : "Đến ngày"}
                </label>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {isEn ? "Tags" : "Thẻ"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = filterTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setFilterTagIds((prev) =>
                            prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchKeywordInput("");
                  setSearchKeyword("");
                  setFilterCategoryId("");
                  setFilterTagIds([]);
                  setFilterStatus("");
                  setFilterFromDate("");
                  setFilterToDate("");
                  void load();
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {isEn ? "Reset" : "Đặt lại"}
              </button>
              <button
                type="button"
                onClick={() => {
                  applySearchKeyword();
                }}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {isEn ? "Apply Filters" : "Áp dụng"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {t.documentList} ({documents.length})
        </h3>
        <button
          type="button"
          onClick={() => setShowDeleted(!showDeleted)}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          {showDeleted ? t.hideDeleted : `${t.deletedDocuments} (${deleted.length})`}
        </button>
      </div>

      {showDeleted ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.nameTitle}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.deletedAt}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {deleted.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-sm text-zinc-900 dark:text-white">
                    {d.documentTitle || d.originalFileName}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {d.deletedAt ? new Date(d.deletedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(d.id)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      {t.restore}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deleted.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">{t.noDeletedDocuments}</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.nameTitle}
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.scope}
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.embeddingStatus}
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-white">
                          {doc.documentTitle || doc.originalFileName}
                        </p>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {visibilityLabels[doc.visibility]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                          getEmbeddingState(doc.embeddingStatus) === "completed"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : getEmbeddingState(doc.embeddingStatus) === "failed"
                              ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                              : getEmbeddingState(doc.embeddingStatus) === "in-progress"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {getEmbeddingState(doc.embeddingStatus) === "completed" && (
                          <CircleCheckBig className="h-3.5 w-3.5" />
                        )}
                        {getEmbeddingState(doc.embeddingStatus) === "failed" && (
                          <CircleAlert className="h-3.5 w-3.5" />
                        )}
                        {getEmbeddingState(doc.embeddingStatus) === "in-progress" && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {mapEmbeddingStatusLabel(doc.embeddingStatus, t)}
                      </span>
                      {getEmbeddingState(doc.embeddingStatus) === "completed" &&
                      embeddingCompletedAtByDocId[doc.id] ? (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {new Date(embeddingCompletedAtByDocId[doc.id]).toLocaleString(
                            language === "en" ? "en-US" : "vi-VN"
                          )}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="relative px-6 py-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => toggleMenu(doc.id, e.currentTarget)}
                        className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-500 dark:hover:bg-zinc-800"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <FileText className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {isEn ? "No documents found" : "Không tìm thấy tài liệu"}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {isEn ? "Upload a document to get started" : "Tải lên tài liệu để bắt đầu"}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Dropdown Menu */}
      {openMenuId && menuPos && typeof document !== "undefined"
        ? createPortal(
          <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpenMenuId(null);
              setMenuPos(null);
            }}
          />
          <div
            className="fixed z-50 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={() => void handleViewDetail(openMenuId)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Eye className="h-4 w-4" /> {isEn ? "View details" : "Xem chi tiết"}
            </button>
            <button
              type="button"
              onClick={() => {
                const doc = documents.find((d) => d.id === openMenuId);
                if (doc) void handleDownload(openMenuId, doc.originalFileName);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" /> {isEn ? "Download" : "Tải xuống"}
            </button>
            {canManageDocument(documents.find((d) => d.id === openMenuId)) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    setMenuPos(null);
                    loadVersions(openMenuId);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <History className="h-4 w-4" /> {isEn ? "Version history" : "Lịch sử phiên bản"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const doc = documents.find((d) => d.id === openMenuId);
                    setOpenMenuId(null);
                    setMenuPos(null);
                    if (doc) setAccessDoc(doc);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Lock className="h-4 w-4" /> {isEn ? "Update access" : "Cập nhật quyền"}
                </button>
                {(() => {
                  const doc = documents.find((d) => d.id === openMenuId);
                  const status = doc?.embeddingStatus?.toUpperCase();
                  const showReindex = status === "FAILED" || status === "COMPLETED";
                  return showReindex ? (
                    <button
                      type="button"
                      onClick={() => void handleReindex(openMenuId)}
                      disabled={reindexing[openMenuId]}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <RotateCcw className={`h-4 w-4 ${reindexing[openMenuId] ? "animate-spin" : ""}`} />
                      {isEn ? "Re-index" : "Re-index lại"}
                    </button>
                  ) : null;
                })()}
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    setMenuPos(null);
                    setNewVersionDocId(openMenuId);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Upload className="h-4 w-4" /> {isEn ? "Upload new version" : "Tải phiên bản mới"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSoftDelete(openMenuId)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-4 w-4" /> {isEn ? "Soft delete" : "Xóa mềm"}
                </button>
              </>
            )}
          </div>
          </>,
          document.body
        )
        : null}
      </>
      )}

      {detailDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {isEn ? "Document details" : "Chi tiết tài liệu"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (detailPreview?.kind === "pdf") URL.revokeObjectURL(detailPreview.url);
                  setDetailDoc(null);
                  setDetailPreview(null);
                  setDetailVersions([]);
                }}
                className="rounded p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  {isEn ? "Document information" : "Thông tin tài liệu"}
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {detailDoc.documentTitle || detailDoc.originalFileName}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {detailDoc.originalFileName}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-zinc-500 dark:text-zinc-400">{isEn ? "Scope:" : "Phạm vi:"}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {visibilityLabels[detailDoc.visibility]}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                  <Files className="h-4 w-4 text-cyan-500" />
                  <span className="text-zinc-500 dark:text-zinc-400">{isEn ? "Chunks:" : "Phân đoạn:"}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {detailDoc.chunkCount ?? 0}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  <span className="text-zinc-500 dark:text-zinc-400">{language === "en" ? "Uploaded:" : "Ngày tải:"}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {new Date(detailDoc.uploadedAt).toLocaleString(language === "en" ? "en-US" : "vi-VN")}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                  <FileText className="h-4 w-4 text-violet-500" />
                  <span className="text-zinc-500 dark:text-zinc-400">{language === "en" ? "Size:" : "Dung lượng:"}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatFileSize(detailDoc.fileSize)}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2">
                  <Upload className="h-4 w-4 text-sky-500" />
                  <span className="text-zinc-500 dark:text-zinc-400">{language === "en" ? "Uploaded by:" : "Người tải lên:"}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {getUploaderDisplayName(detailDoc)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  {isEn ? "Versions" : "Phiên bản"}
                </p>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {detailVersions.length}
                </span>
              </div>
              {detailLoading ? (
                <p className="text-sm text-zinc-500">{isEn ? "Loading versions..." : "Đang tải phiên bản..."}</p>
              ) : detailVersions.length > 0 ? (
                <ul className="max-h-48 space-y-2 overflow-auto pr-1">
                  {detailVersions.map((v) => (
                    <li
                      key={v.versionId}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {isEn ? "Version" : "Phiên bản"} {v.versionNumber}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(v.createdAt).toLocaleString(language === "en" ? "en-US" : "vi-VN")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {v.versionNote?.trim() || "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">
                  {isEn ? "No version history yet." : "Chưa có lịch sử phiên bản."}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                {language === "en" ? "Extracted content (preview)" : "Nội dung trích xuất (xem trước)"}
              </p>
              {detailLoading ? (
                <p className="text-sm text-zinc-500">{language === "en" ? "Loading preview..." : "Đang tải preview..."}</p>
              ) : detailPreview?.kind === "text" && isSpreadsheetFile(detailDoc.fileType, detailDoc.originalFileName) ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-950/25">
                  <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-100/90">
                    {language === "en"
                      ? "Excel visual preview is not shown; download/open the original to view the exact workbook. RAG uses extracted text internally."
                      : "Không hiển thị preview trực quan cho Excel; hãy tải/mở file gốc để xem đúng workbook. RAG sử dụng văn bản trích xuất nội bộ."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDownload(detailDoc.id, detailDoc.originalFileName)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {language === "en" ? "Download original" : "Tải file gốc"}
                  </button>
                </div>
              ) : detailPreview?.kind === "text" ? (
                <>
                  <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-zinc-800 dark:text-zinc-100">
                    {detailPreview.text}
                  </pre>
                  <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-950/25">
                    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">
                      <span className="font-semibold">
                        {language === "en" ? "Extracted text used for search/RAG" : "Văn bản dùng cho tìm kiếm/RAG"}
                      </span> —{" "}
                      {language === "en"
                        ? "The original Excel/Word/PDF layout and images are not shown here. Download the file to view the original document."
                        : "Định dạng gốc của file Excel/Word/PDF không được hiển thị ở đây. Hãy tải xuống để xem file gốc."}
                    </p>
                  </div>
                </>
              ) : detailPreview?.kind === "pdf" ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                  <p>{language === "en" ? "Preview is PDF. Open in a new tab to view fully." : "File preview dạng PDF. Mở ở tab mới để xem đầy đủ."}</p>
                  <a
                    href={detailPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {language === "en" ? "Open PDF" : "Mở PDF"}
                  </a>
                </div>
              ) : detailPreview?.kind === "binary" ? (
                <p className="text-sm text-zinc-500">
                  {language === "en" ? "Unsupported preview format:" : "Không hỗ trợ xem trước định dạng:"} {detailPreview.mime}
                </p>
              ) : (
                <p className="text-sm text-zinc-500">{language === "en" ? "No preview data yet." : "Chưa có dữ liệu preview."}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {embeddingModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-emerald-500/15 p-2 text-emerald-500">
                {getEmbeddingState(embeddingTrackStatus) === "completed" ? (
                  <CircleCheckBig className="h-5 w-5" />
                ) : getEmbeddingState(embeddingTrackStatus) === "failed" ? (
                  <CircleAlert className="h-5 w-5 text-red-500" />
                ) : (
                  <Cpu className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {getEmbeddingState(embeddingTrackStatus) === "completed"
                    ? language === "en" ? "Embedding completed" : "Nhúng tài liệu hoàn tất"
                    : getEmbeddingState(embeddingTrackStatus) === "failed"
                      ? language === "en" ? "Embedding failed" : "Nhúng tài liệu thất bại"
                      : language === "en" ? "Embedding in progress" : "Đang xử lý nhúng tài liệu"}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {embeddingTrackFileName}
                </p>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {getEmbeddingState(embeddingTrackStatus) === "completed"
                  ? language === "en" ? "Completed" : "Hoàn tất"
                  : getEmbeddingState(embeddingTrackStatus) === "failed"
                    ? language === "en" ? "Failed" : "Lỗi xử lý"
                    : language === "en" ? "Running" : "Đang chạy"}
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {Math.round(embeddingProgress)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  getEmbeddingState(embeddingTrackStatus) === "failed"
                    ? "bg-red-500"
                    : "bg-gradient-to-r from-emerald-500 to-cyan-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, embeddingProgress))}%` }}
              />
            </div>

            <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {language === "en" ? "Status:" : "Trạng thái:"} {mapEmbeddingStatusLabel(embeddingTrackStatus, t)}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {getEmbeddingState(embeddingTrackStatus) === "completed" ||
              getEmbeddingState(embeddingTrackStatus) === "failed" ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setEmbeddingModalOpen(false);
                    setEmbeddingTrackDocId(null);
                  }}
                >
                  {language === "en" ? "Close" : "Đóng"}
                </Button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === "en" ? "Tracking..." : "Đang theo dõi..."}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update access */}
      {accessDoc && (
        <UpdateAccessModal
          doc={accessDoc}
          availableDepartments={departments}
          availableRoles={roles}
          onClose={() => setAccessDoc(null)}
          onSave={(body) => handleUpdateAccess(accessDoc.id, body)}
        />
      )}

      {/* Modal: Version history */}
      {versionDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{t.versionHistory}</h3>
              <button type="button" onClick={() => setVersionDocId(null)} className="rounded p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            {versions.length > 0 && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {isEn ? "Select version" : "Chọn phiên bản"}
                </label>
                <div className="relative">
                  <select
                    value={selectedVersionId ?? ""}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {versions.map((v) => (
                      <option key={v.versionId} value={v.versionId}>
                        {(isEn ? "Version" : "Phiên bản")} {v.versionNumber}{v.versionNote ? ` — ${v.versionNote}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                </div>
              </div>
            )}
            <ul className="space-y-2 text-sm">
              {versions.map((v) => (
                <li
                  key={v.versionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedVersionId(v.versionId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedVersionId(v.versionId);
                  }}
                  className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition ${
                    selectedVersionId === v.versionId
                      ? "bg-green-500/10 ring-1 ring-inset ring-green-500/20"
                      : "bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {selectedVersionId === v.versionId ? <Check className="h-4 w-4 text-green-600 dark:text-green-400" /> : <span className="text-[11px]">{v.versionNumber}</span>}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">
                        {(isEn ? "Version" : "Phiên bản")} {v.versionNumber}
                      </div>
                      <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {v.versionNote || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(v.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal: Upload new version */}
      {newVersionDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{t.uploadNewVersion}</h3>
              <button type="button" onClick={() => setNewVersionDocId(null)} className="rounded p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUploadNewVersion} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{isEn ? "New file" : "File mới"}</label>
                <input name="versionFile" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv" className="block w-full rounded-lg border border-zinc-300 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{isEn ? "Version note" : "Ghi chú phiên bản"}</label>
                <input
                  name="versionNote"
                  type="text"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder={isEn ? "Optional" : "Tùy chọn"}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="md" disabled={uploading}>
                  {uploading ? t.uploading : t.uploadNewVersion}
                </Button>
                <Button type="button" variant="outline" size="md" onClick={() => setNewVersionDocId(null)}>{t.cancel}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}

function UpdateAccessModal({
  doc,
  availableDepartments,
  availableRoles,
  onClose,
  onSave,
}: {
  doc: DocumentResponse;
  availableDepartments: DepartmentResponse[];
  availableRoles: RoleResponse[];
  onClose: () => void;
  onSave: (body: UpdateDocumentAccessRequest) => void;
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";
  const visibilityLabels = getVisibilityLabels(language);

  const [visibility, setVisibility] = useState<DocumentVisibility>(doc.visibility);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>(
    doc.accessibleDepartments ?? []
  );
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>(
    doc.accessibleRoles ?? []
  );
  const [minimumRoleLevel, setMinimumRoleLevel] = useState<number>(doc.minimumRoleLevel ?? 4);
  const requiresDepartments =
    visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES";
  const requiresRoles =
    visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES";
  const departmentSelectionInvalid = requiresDepartments && selectedDepartmentIds.length === 0;
  const roleSelectionInvalid = requiresRoles && selectedRoleIds.length === 0;
  const roleScoped = visibilityUsesRoleScope(visibility);

  useEffect(() => {
    setMinimumRoleLevel(doc.minimumRoleLevel ?? 4);
  }, [doc.id, doc.minimumRoleLevel]);

  const toggleDepartment = (departmentId: number) => {
    setSelectedDepartmentIds((prev) =>
      prev.includes(departmentId)
        ? prev.filter((id) => id !== departmentId)
        : [...prev, departmentId]
    );
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (departmentSelectionInvalid) {
      return;
    }
    if (roleSelectionInvalid) {
      return;
    }
    const resolvedMinimumRoleLevel = roleScoped
      ? deriveMinimumRoleLevelFromSelectedRoles(selectedRoleIds, availableRoles)
      : minimumRoleLevel;
    const body: UpdateDocumentAccessRequest = {
      visibility,
      minimumRoleLevel: resolvedMinimumRoleLevel,
      accessibleDepartments:
        visibility === "SPECIFIC_DEPARTMENTS" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES"
          ? selectedDepartmentIds
          : null,
      accessibleRoles:
        visibility === "SPECIFIC_ROLES" || visibility === "SPECIFIC_DEPARTMENTS_AND_ROLES"
          ? selectedRoleIds
          : null,
    };
    onSave(body);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {isEn ? "Update access" : "Cập nhật quyền truy cập"}
            </h3>
            <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
              {doc.documentTitle || doc.originalFileName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t.scope}
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {Object.entries(visibilityLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {roleScoped ? (
            <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/80 p-4 text-sm text-cyan-950 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100">
              <p className="font-medium text-cyan-950 dark:text-cyan-50">
                {isEn ? "Level from selected roles" : "Mức theo vai trò đã chọn"}
              </p>
              <p className="mt-1 text-xs text-cyan-900/90 dark:text-cyan-200/90">
                {isEn
                  ? `Minimum role level sent on save = ${deriveMinimumRoleLevelFromSelectedRoles(selectedRoleIds, availableRoles)} (highest 1–5 among selected roles; 4 if level missing).`
                  : `Khi lưu, mức tối thiểu = ${deriveMinimumRoleLevelFromSelectedRoles(selectedRoleIds, availableRoles)} (lấy mức lớn nhất 1–5 trong các role; mặc định 4 nếu thiếu level).`}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isEn ? "Minimum role level (1–5)" : "Mức tối thiểu để xem (1–5)"}
              </label>
              <select
                value={minimumRoleLevel}
                onChange={(e) => setMinimumRoleLevel(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {[1, 2, 3, 4, 5].map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                {isEn
                  ? "User level X only sees chunks when this value >= X."
                  : "User level X chỉ thấy chunk khi giá trị này >= X."}
              </p>
            </div>
          )}

          {(requiresDepartments || requiresRoles) && (
            <div className="grid gap-4 md:grid-cols-2">
              {requiresDepartments && (
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {isEn ? "Select departments" : "Chọn phòng ban"}
                    </label>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      {selectedDepartmentIds.length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {availableDepartments.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {isEn ? "No departments available." : "Không có dữ liệu phòng ban khả dụng."}
                      </p>
                    ) : (
                      availableDepartments.map((dept) => {
                        const active = selectedDepartmentIds.includes(dept.id);
                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => toggleDepartment(dept.id)}
                            className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-transform duration-150 hover:scale-[1.03] ${
                              active
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            }`}
                          >
                            {dept.name ?? (isEn ? `Department ${dept.id}` : `Phòng ban ${dept.id}`)}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {departmentSelectionInvalid && (
                    <p className="mt-2 text-xs text-red-500">
                      {isEn ? "Please select at least one department." : "Vui lòng chọn ít nhất 1 phòng ban."}
                    </p>
                  )}
                </section>
              )}

              {requiresRoles && (
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {isEn ? "Select roles" : "Chọn vai trò"}
                    </label>
                    <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300">
                      {selectedRoleIds.length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {availableRoles.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {isEn ? "No roles available." : "Không có dữ liệu vai trò khả dụng."}
                      </p>
                    ) : (
                      availableRoles.map((role) => {
                        const active = selectedRoleIds.includes(role.id);
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => toggleRole(role.id)}
                            className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-transform duration-150 hover:scale-[1.03] ${
                              active
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            }`}
                          >
                            {role.name ?? role.code ?? (isEn ? `Role ${role.id}` : `Vai trò ${role.id}`)}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {roleSelectionInvalid && (
                    <p className="mt-2 text-xs text-red-500">
                      {isEn ? "Please select at least one role." : "Vui lòng chọn ít nhất 1 vai trò."}
                    </p>
                  )}
                </section>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="min-w-24 justify-center rounded-xl px-4 shadow-md shadow-emerald-500/20 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/25"
            >
              {t.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="min-w-24 justify-center rounded-xl border-zinc-300 bg-white px-4 transition-transform duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-50 dark:bg-zinc-900"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
