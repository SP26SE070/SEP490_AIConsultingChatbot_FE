"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  FileText,
  Calendar,
  Tag,
  Download,
  History,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileType,
  HardDrive,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { ChatbotEntryLoading, ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";
import type { DocumentResponse, DocumentCategoryResponse, DocumentTagResponse } from "@/types/knowledge";
import {
  listDocuments,
  getDocument,
  getDocumentPreview,
  getDocumentVersionPreview,
  downloadDocument,
  downloadDocumentVersion,
  getVersionHistory,
  getActiveRagVersion,
  setActiveRagVersion,
  type ListDocumentsParams,
} from "@/lib/api/documents";
import type { DocumentPreviewResponse } from "@/lib/api/documents";
import { clearAuth, refreshAuth, tryRefreshAuth } from "@/lib/auth-store";
import type { DocumentVersionResponse } from "@/types/knowledge";
import { getProfile } from "@/lib/api/profile";
import { cn } from "@/lib/utils/cn";
import { listCategoriesFlat } from "@/lib/api/categories";
import { listTagsActive } from "@/lib/api/tags";


/** Một dòng / một đoạn theo ký tự xuống dòng từ API (giữ đúng cấu trúc file gốc). */
function PreviewPlainText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-0">
      {lines.map((line, i) => (
        <div key={i} className="min-h-[1.5em] whitespace-pre-wrap wrap-break-word">
          {line.length === 0 ? "\u00a0" : line}
        </div>
      ))}
    </div>
  );
}

/** Nội dung đọc được: GET .../content?mode=preview (full text) hoặc khối tóm tắt từ GET .../detail/{id} */
function DocumentReadablePanel({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 shadow-inner ring-1 ring-black/3 dark:border-zinc-800/90 dark:from-zinc-900/95 dark:to-zinc-950 dark:ring-white/6",
        className
      )}
    >
      {label ? (
        <div className="shrink-0 border-b border-zinc-200 px-5 pb-3 pt-4 sm:px-6 sm:pt-5 dark:border-zinc-800/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400/95">{label}</p>
        </div>
      ) : null}
      <div className="scrollbar-chat-hidden min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
        <div className="select-text text-[15px] leading-[1.75] text-zinc-700 antialiased dark:text-zinc-100">{children}</div>
      </div>
    </div>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tô sáng từng khớp (nhiều từ cách nhau bằng khoảng trắng), không phân biệt hoa thường */
function HighlightMatches({ text, query }: { text: string; query: string }) {
  const raw = query.trim();
  if (!raw) return <>{text}</>;
  const terms = raw.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return <>{text}</>;
  const pattern = terms.map((t) => escapeRegExp(t)).join("|");
  let re: RegExp;
  try {
    re = new RegExp(`(${pattern})`, "gi");
  } catch {
    return <>{text}</>;
  }
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some((t) => part.toLowerCase() === t.toLowerCase());
        return isMatch ? (
          <mark
            key={i}
            className="rounded-sm bg-emerald-400/30 px-0.5 font-semibold text-emerald-50 [box-decoration-break:clone]"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export interface SearchViewProps {
  initialQuery?: string;
  permissionTabs?: string[];
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function visibilityLabel(vis: string | undefined, en: boolean): string {
  switch (vis) {
    case "COMPANY_WIDE":
      return en ? "Company-wide" : "Toàn công ty";
    case "SPECIFIC_DEPARTMENTS":
      return en ? "Selected departments" : "Theo phòng ban";
    case "SPECIFIC_ROLES":
      return en ? "Selected roles" : "Theo vai trò";
    case "SPECIFIC_DEPARTMENTS_AND_ROLES":
      return en ? "Departments & roles" : "Phòng ban & vai trò";
    default:
      return vis ?? "—";
  }
}

function embeddingLabel(status: string | undefined, en: boolean): string {
  const u = (status ?? "").toUpperCase();
  if (u.includes("READY") || u === "COMPLETED" || u === "SUCCESS")
    return en ? "Indexed" : "Đã nhúng";
  if (u.includes("PEND") || u === "QUEUED") return en ? "Pending" : "Đang chờ";
  if (u.includes("FAIL") || u.includes("ERROR")) return en ? "Failed" : "Lỗi";
  if (u.includes("PROCESS")) return en ? "Processing" : "Đang xử lý";
  return status ?? "—";
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error == null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function getErrorTraceId(error: unknown): string | null {
  if (typeof error !== "object" || error == null) return null;
  const traceId = (error as { traceId?: unknown }).traceId;
  return typeof traceId === "string" && traceId.trim().length > 0 ? traceId.trim() : null;
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

export function SearchView({ initialQuery, permissionTabs = [] }: SearchViewProps) {
  const router = useRouter();
  const { language } = useLanguageStore();
  const sharedTranslations = translations[language];
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [documentsErrorStatus, setDocumentsErrorStatus] = useState<number | null>(null);
  const [selected, setSelected] = useState<DocumentResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const pdfObjectUrlRef = useRef<string | null>(null);
  const previewKeyRef = useRef<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreviewResponse | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [activeRagId, setActiveRagId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [profileRoleName, setProfileRoleName] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocumentResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** Background list refresh (polling / tab focus) — không che màn hình */
  const [listSyncing, setListSyncing] = useState(false);
  
  // Filter states for advanced search
  const [categories, setCategories] = useState<DocumentCategoryResponse[]>([]);
  const [tags, setTags] = useState<DocumentTagResponse[]>([]);
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  const normalizedPermissionTabs = useMemo(
    () =>
      permissionTabs.filter((code) =>
        code === "DOCUMENT_READ" || code === "DOCUMENT_WRITE" || code === "DOCUMENT_DELETE"
      ),
    [permissionTabs]
  );
  const canReadDocuments =
    normalizedPermissionTabs.includes("DOCUMENT_READ") ||
    normalizedPermissionTabs.includes("DOCUMENT_WRITE") ||
    normalizedPermissionTabs.includes("DOCUMENT_DELETE");

  const t = useMemo(
    () => ({
      searchPlaceholder:
        language === "en" ? "Search documents by title or tag…" : "Tìm theo tiêu đề hoặc thẻ…",
      noDocs:
        language === "en"
          ? "No documents match your search."
          : "Không có tài liệu phù hợp.",
      listEmpty:
        language === "en" ? "No documents found." : "Không có tài liệu.",
      details: language === "en" ? "Details" : "Chi tiết",
      preview: language === "en" ? "Preview" : "Xem trước",
      close: language === "en" ? "Close" : "Đóng",
      download: language === "en" ? "Download" : "Tải xuống",
      versions: language === "en" ? "Versions" : "Xem phiên bản",
      setRag: language === "en" ? "Set as RAG active" : "Đặt làm bản RAG active",
      syncingHint:
        language === "en" ? "Syncing permissions & list…" : "Đang đồng bộ quyền & danh sách…",
      permPreview:
        language === "en"
          ? "You do not have permission to preview this document inline."
          : "Bạn chưa có quyền xem trực tiếp nội dung tài liệu.",
      preview401:
        language === "en"
          ? "Session expired or missing token. Please login again."
          : "Phiên đăng nhập đã hết hạn hoặc thiếu token. Vui lòng đăng nhập lại.",
      preview404:
        language === "en"
          ? "Document does not exist or you do not have permission."
          : "Tài liệu không tồn tại hoặc bạn không có quyền truy cập.",
      preview415:
        language === "en"
          ? "This format is not supported for preview. Please use Download."
          : "Định dạng này chưa hỗ trợ preview. Vui lòng tải file gốc.",
      preview422:
        language === "en"
          ? "No extractable text for preview (e.g. scanned PDF). Please download the file."
          : "Không trích được văn bản để xem trước (ví dụ PDF scan). Vui lòng tải file gốc.",
      preview500:
        language === "en"
          ? "Server or storage error while loading preview. Please retry later."
          : "Lỗi máy chủ hoặc object storage khi tải xem trước. Vui lòng thử lại sau.",
      previewHint:
        language === "en"
          ? "Direct preview depends on backend render support. TXT/PDF are native; DOC/DOCX/XLS/XLSX require server-side render mode."
          : "Xem trực tiếp phụ thuộc khả năng render của backend. TXT/PDF xem trực tiếp được; DOC/DOCX/XLS/XLSX cần backend render.",
      download401:
        language === "en"
          ? "Download failed: missing/invalid token. Please login again."
          : "Tải xuống thất bại: thiếu hoặc sai token. Vui lòng đăng nhập lại.",
      download404:
        language === "en"
          ? "Download failed: document/version not found."
          : "Tải xuống thất bại: không tìm thấy tài liệu/phiên bản.",
      download500:
        language === "en"
          ? "Download failed due to server/object storage error."
          : "Tải xuống thất bại do lỗi máy chủ/object storage.",
      downloadUnknown:
        language === "en"
          ? "Download failed. Please try again."
          : "Tải xuống thất bại. Vui lòng thử lại.",
      previewVersionBadge:
        language === "en" ? "Version preview" : "Xem trước phiên bản",
      previewCurrent:
        language === "en" ? "Preview current" : "Xem bản hiện tại",
      previewVersionAction:
        language === "en" ? "Preview" : "Xem trước",
      downloadVersionAction:
        language === "en" ? "Download" : "Tải xuống",
      backToList: language === "en" ? "Back to list" : "Quay lại danh sách",
      loading: language === "en" ? "Loading…" : "Đang tải…",
      metaType: language === "en" ? "Format" : "Định dạng",
      metaSize: language === "en" ? "Size" : "Dung lượng",
      metaVisibility: language === "en" ? "Access" : "Phạm vi truy cập",
      metaEmbedding: language === "en" ? "Search index" : "Chỉ mục tìm kiếm",
      metaChunks: language === "en" ? "Text chunks" : "Đoạn văn (chunk)",
      aboutDoc: language === "en" ? "Summary" : "Tóm tắt",
      /** Toàn bộ nội dung từ GET .../content?mode=preview */
      previewContentTitle:
        language === "en" ? "Extracted text content (preview)" : "Nội dung trích xuất (xem trước)",
      previewTextDisclaimerTitle:
        language === "en"
          ? "Extracted text used for search/RAG"
          : "Văn bản dùng cho tìm kiếm/RAG",
      previewTextDisclaimerBody:
        language === "en"
          ? "The original Excel/Word/PDF layout and images are not shown here. Download the file to view the original document."
          : "Định dạng gốc của file Excel/Word/PDF không được hiển thị ở đây. Hãy tải xuống để xem file gốc.",
      downloadOriginalFile:
        language === "en" ? "Download original file" : "Tải file gốc",
      /** Tóm tắt / mô tả từ GET .../detail/{id} — không thay cho nội dung file */
      summaryFromDetailApi:
        language === "en"
          ? "Catalog summary (document detail)"
          : "Tóm tắt / mô tả (chi tiết tài liệu)",
      originalFile: language === "en" ? "Original file" : "Tệp gốc",
      pdfOpenNewTab:
        language === "en" ? "Open PDF in new tab" : "Mở PDF trong tab mới",
      previewBadgeText: language === "en" ? "Text" : "Văn bản",
      previewBadgePdf: language === "en" ? "PDF" : "PDF",
      previewBadgeOther: language === "en" ? "Preview" : "Xem trước",
      tagsLabel: language === "en" ? "Tags" : "Thẻ",
      permissionNone:
        language === "en"
          ? "No document permissions assigned yet"
          : "Chưa được cấp quyền tài liệu",
      filters: language === "en" ? "Filters" : "Bộ lọc",
      advancedFilters: language === "en" ? "Advanced Filters" : "Bộ lọc nâng cao",
      category: language === "en" ? "Category" : "Danh mục",
      status: language === "en" ? "Status" : "Trạng thái",
      fromDate: language === "en" ? "From" : "Từ ngày",
      toDate: language === "en" ? "To" : "Đến ngày",
      allCategories: language === "en" ? "All" : "Tất cả",
      allStatuses: language === "en" ? "All" : "Tất cả",
      statusCompleted: sharedTranslations.statusCompleted,
      statusPending: sharedTranslations.statusPending,
      statusProcessing: sharedTranslations.statusProcessing,
      statusFailed: sharedTranslations.statusFailed,
      reset: language === "en" ? "Reset" : "Đặt lại",
      applyFilters: language === "en" ? "Apply Filters" : "Áp dụng",
      searchAction: language === "en" ? "Search" : "Tìm",
      chatAboutDocument:
        language === "en" ? "Chat about this document" : "Hỏi chatbot về tài liệu này",
      chatAboutDocumentHint:
        language === "en"
          ? "Opens chat scoped to this document (RAG only from this file)."
          : "Mở chat chỉ dùng nội dung tài liệu này cho RAG.",
    }),
    [language, sharedTranslations]
  );

  useEffect(() => {
    if (!initialQuery) return;
    setQueryInput(initialQuery);
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    getProfile()
      .then((p) => setProfileRoleName(p.roleName ?? null))
      .catch(() => setProfileRoleName(null));
  }, []);

  const loadList = useCallback((options?: { silent?: boolean }) => {
    if (!canReadDocuments) {
      setDocuments([]);
      setDocumentsErrorStatus(null);
      setListLoading(false);
      setListSyncing(false);
      return;
    }
    const silent = options?.silent ?? false;

    void (async () => {
      if (silent) setListSyncing(true);
      else {
        setListLoading(true);
        setDocumentsErrorStatus(null);
      }
      try {
        try {
          // Build filter params
          const params: ListDocumentsParams = {};
          if (query.trim()) params.keyword = query.trim();
          if (filterCategoryId) params.categoryId = filterCategoryId;
          if (filterTagIds.length > 0) params.tagIds = filterTagIds;
          if (filterStatus) params.status = filterStatus;
          if (filterFromDate) params.fromDate = `${filterFromDate}T00:00:00`;
          if (filterToDate) params.toDate = `${filterToDate}T23:59:59`;
          
          const [rows, cats, activeTags] = await Promise.all([
            listDocuments(params),
            listCategoriesFlat().catch(() => []),
            listTagsActive().catch(() => []),
          ]);
          setDocuments(rows);
          setCategories(cats);
          setTags(activeTags);
          setDocumentsErrorStatus(null);
        } catch (e: unknown) {
          const err = e as Error & { status?: number };
          const status = typeof err.status === "number" ? err.status : null;
          if (status === 401) {
            clearAuth();
            router.push("/login");
            return;
          }
          if (silent) {
            // Đồng bộ nền: không xóa list đang có — tránh cảm giác “mất hết” khi token chưa kịp refresh / lỗi mạng tạm
            return;
          }
          /**
           * 403: JWT hiện tại có thể được cấp *trước* khi admin thêm DOCUMENT_READ.
           * tryRefreshAuth() đôi khi không đổi token; refreshAuth() gọi /auth/refresh và ghi đè JWT từ DB.
           */
          if (status === 403) {
            const ok = await refreshAuth();
            if (ok) {
              try {
                const params2: ListDocumentsParams = {};
                if (query.trim()) params2.keyword = query.trim();
                if (filterCategoryId) params2.categoryId = filterCategoryId;
                if (filterTagIds.length > 0) params2.tagIds = filterTagIds;
                if (filterStatus) params2.status = filterStatus;
                if (filterFromDate) params2.fromDate = `${filterFromDate}T00:00:00`;
                if (filterToDate) params2.toDate = `${filterToDate}T23:59:59`;
                
                const rows2 = await listDocuments(params2);
                setDocuments(rows2);
                setDocumentsErrorStatus(null);
                return;
              } catch (e2: unknown) {
                const err2 = e2 as Error & { status?: number };
                const st2 = typeof err2.status === "number" ? err2.status : null;
                if (st2 === 401) {
                  clearAuth();
                  router.push("/login");
                  return;
                }
                setDocuments([]);
                setDocumentsErrorStatus(st2);
                return;
              }
            }
          }
          setDocuments([]);
          setDocumentsErrorStatus(status);
        }
      } finally {
        if (silent) setListSyncing(false);
        else setListLoading(false);
      }
    })();
  }, [canReadDocuments, router, query, filterCategoryId, filterTagIds, filterStatus, filterFromDate, filterToDate]);

  const applySearch = useCallback(() => {
    const nextQuery = queryInput.trim();
    setQuery(nextQuery);
  }, [queryInput]);

  /** Làm mới JWT trước khi gọi API lần đầu — giảm 403 do token cũ sau khi admin cấp quyền. */
  useEffect(() => {
    let cancelled = false;
    if (!canReadDocuments) return;
    void (async () => {
      await tryRefreshAuth();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadDocuments]);

  useEffect(() => {
    if (!canReadDocuments) return;
    void loadList();
  }, [canReadDocuments, query, filterCategoryId, filterTagIds, filterStatus, filterFromDate, filterToDate, loadList]);

  useEffect(() => {
    if (!selected) {
      setDetailDoc(null);
      return;
    }
    setDetailLoading(true);
    setDetailDoc(null);
    void getDocument(selected.id)
      .then(setDetailDoc)
      .catch(() => setDetailDoc(null))
      .finally(() => setDetailLoading(false));
  }, [selected?.id]);

  const displayDoc = detailDoc ?? selected;
  const isSelectedSpreadsheet = isSpreadsheetFile(displayDoc?.fileType, displayDoc?.originalFileName);

  const filtered = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return documents;
    const terms = raw.split(/\s+/).filter((t) => t.length > 0);
    if (terms.length === 0) return documents;
    return documents.filter((d) => {
      const title = (d.documentTitle || d.originalFileName).toLowerCase();
      const tags = d.tags?.map((x) => x.name.toLowerCase()).join(" ") ?? "";
      const desc = (d.description ?? "").toLowerCase();
      const haystack = `${title} ${tags} ${desc}`;
      return terms.every((term) => haystack.includes(term));
    });
  }, [documents, query]);

  const sortedFiltered = useMemo(() => {
    const list = [...filtered];
    const titleOf = (d: DocumentResponse) => d.documentTitle || d.originalFileName;
    list.sort((a, b) => titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: "base" }));
    return list;
  }, [filtered]);

  const canSetRagActive = useMemo(() => {
    const r = (profileRoleName ?? "").toUpperCase();
    return r.includes("ADMIN") || r.includes("MANAGER");
  }, [profileRoleName]);

  const getPreviewErrorMessage = useCallback(
    (status: number | null): string => {
      if (status === 403) return t.permPreview;
      if (status === 401) return t.preview401;
      if (status === 404) return t.preview404;
      if (status === 415) return t.preview415;
      if (status === 422) return t.preview422;
      if (status === 500) return t.preview500;
      return t.previewHint;
    },
    [t.permPreview, t.preview401, t.preview404, t.preview415, t.preview422, t.preview500, t.previewHint]
  );

  const getDownloadErrorMessage = useCallback(
    (status: number | null): string => {
      if (status === 401) return t.download401;
      if (status === 404) return t.download404;
      if (status === 500) return t.download500;
      return t.downloadUnknown;
    },
    [t.download401, t.download404, t.download500, t.downloadUnknown]
  );

  const loadPreview = useCallback(
    async (documentId: string, versionId?: string | null) => {
      const previewKey = `${documentId}::${versionId ?? "current"}`;
      const samePreview = previewKeyRef.current === previewKey;

      if (!samePreview && pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
        pdfObjectUrlRef.current = null;
      }

      setPreviewLoading(true);
      setPreviewError(null);
      if (!samePreview) setPreview(null);

      try {
        const data = versionId
          ? await getDocumentVersionPreview(documentId, versionId)
          : await getDocumentPreview(documentId);

        if (data.kind === "pdf") {
          if (pdfObjectUrlRef.current && pdfObjectUrlRef.current !== data.url) {
            URL.revokeObjectURL(pdfObjectUrlRef.current);
          }
          pdfObjectUrlRef.current = data.url;
        } else if (pdfObjectUrlRef.current) {
          URL.revokeObjectURL(pdfObjectUrlRef.current);
          pdfObjectUrlRef.current = null;
        }

        setPreview(data);
        previewKeyRef.current = previewKey;
        setPreviewVersionId(versionId ?? null);
        console.debug("[preview] metadata", data.meta);
      } catch (error) {
        const status = getErrorStatus(error);
        const traceId = getErrorTraceId(error);
        setPreviewError(getPreviewErrorMessage(status));
        if (traceId) console.debug("[preview] traceId", traceId);
        if (status === 401) {
          clearAuth();
          router.push("/login");
          return;
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [getPreviewErrorMessage, router]
  );

  useEffect(() => {
    if (!selected) return;
    void loadPreview(selected.id, null);
  }, [selected?.id, loadPreview]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
        pdfObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setVersionsOpen(false);
    setVersions([]);
    setPreviewVersionId(null);
    setActionError(null);
    setActiveRagId(null);
  }, [selected?.id]);

  const toggleVersions = async () => {
    if (!selected) return;
    if (versionsOpen) {
      setVersionsOpen(false);
      return;
    }
    setVersionsOpen(true);
    setVersionsLoading(true);
    try {
      const [hist, rag] = await Promise.all([
        getVersionHistory(selected.id),
        getActiveRagVersion(selected.id).catch(() => null),
      ]);
      setVersions(hist);
      setActiveRagId(rag?.active_version_id ?? null);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleVersionPreview = async (documentId: string, versionId: string) => {
    await loadPreview(documentId, versionId);
  };

  const handleDownload = async (doc: DocumentResponse, versionId?: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const file = versionId
        ? await downloadDocumentVersion(doc.id, versionId)
        : await downloadDocument(doc.id);

      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename ?? doc.originalFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const status = getErrorStatus(error);
      setActionError(getDownloadErrorMessage(status));
      if (status === 401) {
        clearAuth();
        router.push("/login");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetRag = async (documentId: string, versionId: string) => {
    if (!canSetRagActive) return;
    setActionLoading(true);
    try {
      await setActiveRagVersion(documentId, versionId);
      setActiveRagId(versionId);
    } finally {
      setActionLoading(false);
    }
  };

  const listMessage = () => {
    if (!listLoading && documents.length === 0 && !documentsErrorStatus) return t.listEmpty;
    return null;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800/90 dark:bg-zinc-950 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col">
          <div className="flex w-full items-start justify-between gap-3">
            <div
              className="flex min-w-0 flex-1 flex-row flex-nowrap items-baseline gap-x-2 overflow-x-auto text-left [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-x-3"
              title={
                language === "en"
                  ? "Access document workspace based on your assigned permissions."
                  : "Truy cập không gian tài liệu theo quyền đã được cấp."
              }
            >
              <h1 className="shrink-0 text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl dark:text-white">
                {language === "en" ? "Documents" : "Tài liệu"}
              </h1>
              <p className="shrink-0 whitespace-nowrap text-xs leading-normal text-zinc-500 sm:text-[13px]">
                {language === "en"
                  ? "Access document workspace based on your assigned permissions."
                  : "Truy cập không gian tài liệu theo quyền đã được cấp."}
              </p>
            </div>
            {listSyncing ? (
              <span
                className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-emerald-400/95"
                title={t.syncingHint}
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                <span className="hidden sm:inline">{t.syncingHint}</span>
              </span>
            ) : null}
          </div>
          {!canReadDocuments ? (
            <div className="mt-4 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {t.permissionNone}
            </div>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-chat-hidden flex-1 overflow-y-auto scroll-smooth px-4 py-8 sm:px-6">
        {canReadDocuments ? (
          <>
            <div className="mx-auto mb-3 w-full max-w-6xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                  }}
                  placeholder={t.searchPlaceholder}
                  autoComplete="off"
                  className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-10 pr-52 text-sm text-zinc-900 shadow-inner placeholder-zinc-400 outline-none ring-emerald-500/0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
                  <button
                    type="button"
                    onClick={applySearch}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {t.searchAction}
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
                    {t.filters}
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Advanced Filters */}
            {showFilters && (
              <div className="mx-auto mb-5 w-full max-w-6xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {t.advancedFilters}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
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
                      <option value="">{t.allCategories}</option>
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
                      {t.status}
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    >
                      <option value="">{t.allStatuses}</option>
                      <option value="COMPLETED">{t.statusCompleted}</option>
                      <option value="PENDING">{t.statusPending}</option>
                      <option value="PROCESSING">{t.statusProcessing}</option>
                      <option value="FAILED">{t.statusFailed}</option>
                    </select>
                  </div>

                  {/* From Date */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {t.fromDate}
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
                      {t.toDate}
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
                      {t.tagsLabel}
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
                      setQueryInput("");
                      setQuery("");
                      setFilterCategoryId("");
                      setFilterTagIds([]);
                      setFilterStatus("");
                      setFilterFromDate("");
                      setFilterToDate("");
                    }}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t.reset}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadList()}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {t.applyFilters}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
        {listLoading ? (
          <ChatbotEntryLoading variant="panel" />
        ) : listMessage() ? (
          <div className="mx-auto flex max-w-lg justify-center px-2">
            <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-10 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-black/20">
              <FileText className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600" />
              <p className="mt-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{listMessage()}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto max-w-6xl px-2 text-center">
            <p className="text-sm text-zinc-400">{t.noDocs}</p>
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {sortedFiltered.map((doc) => {
              const title = doc.documentTitle || doc.originalFileName;
              const descLine = doc.description || doc.fileType.toUpperCase();
              const active = selected?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelected(doc)}
                  className={`flex min-h-46 flex-col rounded-2xl border p-4 text-left shadow-md transition-all duration-200 sm:min-h-48 ${
                    active
                      ? "border-emerald-500/70 bg-emerald-50 ring-1 ring-emerald-500/30 dark:bg-emerald-950/35 dark:ring-emerald-500/40"
                      : "border-zinc-200 bg-linear-to-b from-white to-zinc-50 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-emerald-500/10 dark:border-white/8 dark:from-zinc-900/90 dark:to-zinc-950 dark:hover:shadow-emerald-900/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-white">
                        <HighlightMatches text={title} query={query} />
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
                        <HighlightMatches text={descLine} query={query} />
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-white/6 dark:text-zinc-500">
                    <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                      <Calendar className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
                      {new Date(doc.uploadedAt).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}
                    </span>
                    {doc.tags?.length ? (
                      <span className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
                        {doc.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex max-w-28 items-center gap-0.5 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-300"
                          >
                            <Tag className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">
                              <HighlightMatches text={tag.name} query={query} />
                            </span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>


      {selected && typeof document !== "undefined"
        ? createPortal(
            (
              <div
                className="fixed inset-0 z-110 overflow-y-auto overflow-x-hidden bg-black/50 backdrop-blur-[2px] dark:bg-black/65"
                role="dialog"
                aria-modal
                onClick={() => setSelected(null)}
              >
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
            <div
              className="my-4 flex max-h-[min(92dvh,calc(100dvh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-300 bg-white shadow-2xl ring-1 ring-black/5 dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/50 dark:ring-white/6 lg:max-h-[min(88dvh,calc(100dvh-2.5rem))] lg:flex-row"
              onClick={(e) => e.stopPropagation()}
              aria-labelledby="document-detail-title"
            >
            <div className="flex min-h-0 w-full min-w-0 flex-col border-b border-zinc-200 lg:w-[min(100%,26rem)] lg:max-w-md lg:shrink-0 lg:border-b-0 lg:border-r lg:border-zinc-200 dark:border-zinc-800/90 dark:lg:border-zinc-800/90">
              <div className="relative shrink-0 bg-linear-to-br from-emerald-50 via-white to-zinc-50 px-4 pb-4 pt-4 dark:from-emerald-950/55 dark:via-zinc-900/95 dark:to-zinc-950 sm:px-6 sm:pb-5 sm:pt-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(16,185,129,0.12),transparent_55%)]" />
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="relative mb-3 inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700/80 dark:bg-zinc-900/65 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t.backToList}
                </button>
                <div className="relative flex gap-3.5 pr-4 sm:gap-4 sm:pr-6">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 ring-1 ring-emerald-500/25 shadow-inner shadow-emerald-950/40 sm:size-14">
                    <FileText className="h-6 w-6 text-emerald-400 sm:h-7 sm:w-7" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/90">
                      {t.details}
                    </p>
                    {detailLoading ? (
                      <h2
                        id="document-detail-title"
                        className="mt-1 flex items-center gap-2 text-base font-semibold leading-snug text-zinc-900 dark:text-white sm:text-lg"
                      >
                        <ChatbotSpinner size="sm" className="shrink-0" />
                        <span className="truncate text-zinc-500 dark:text-zinc-300">
                          {selected.documentTitle || selected.originalFileName}
                        </span>
                      </h2>
                    ) : (
                      <h2
                        id="document-detail-title"
                        className="mt-1 text-base font-semibold leading-snug text-zinc-900 dark:text-white sm:text-lg"
                      >
                        {displayDoc?.documentTitle || displayDoc?.originalFileName}
                      </h2>
                    )}
                    {displayDoc?.documentTitle &&
                    displayDoc.originalFileName &&
                    displayDoc.documentTitle !== displayDoc.originalFileName ? (
                      <p className="mt-1.5 truncate text-xs text-zinc-500 dark:text-zinc-500" title={displayDoc.originalFileName}>
                        <span className="text-zinc-600 dark:text-zinc-600">{t.originalFile}</span>{" "}
                        {displayDoc.originalFileName}
                      </p>
                    ) : null}
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-600" />
                      {new Date(displayDoc?.uploadedAt ?? selected.uploadedAt).toLocaleDateString(
                        language === "vi" ? "vi-VN" : "en-US",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="scrollbar-chat-hidden flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-inner dark:border-white/6 dark:bg-zinc-950/50">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      <FileType className="h-3 w-3 text-emerald-600 dark:text-emerald-500/80" aria-hidden />
                      {t.metaType}
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={displayDoc?.fileType}>
                      {(displayDoc?.fileType ?? "—").toUpperCase()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-inner dark:border-white/6 dark:bg-zinc-950/50">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      <HardDrive className="h-3 w-3 text-emerald-600 dark:text-emerald-500/80" aria-hidden />
                      {t.metaSize}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {displayDoc != null ? formatFileSize(displayDoc.fileSize) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-inner dark:border-white/6 dark:bg-zinc-950/50">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-500/80" aria-hidden />
                      {t.metaVisibility}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100">
                      {visibilityLabel(displayDoc?.visibility, language === "en")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-inner dark:border-white/6 dark:bg-zinc-950/50">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-500/80" aria-hidden />
                      {t.metaEmbedding}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100">
                      {embeddingLabel(displayDoc?.embeddingStatus, language === "en")}
                    </p>
                  </div>
                  {displayDoc?.chunkCount != null ? (
                    <div className="col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-inner dark:border-white/6 dark:bg-zinc-950/50">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        <Layers className="h-3 w-3 text-emerald-600 dark:text-emerald-500/80" aria-hidden />
                        {t.metaChunks}
                      </div>
                      <p className="mt-1.5 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                        {displayDoc.chunkCount.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}
                      </p>
                    </div>
                  ) : null}
                </div>

                {displayDoc?.tags?.length ? (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {t.tagsLabel}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {displayDoc.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-100/95"
                        >
                          <Tag className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                          <span className="truncate">{tag.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {displayDoc?.description?.trim() ? (
                  <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/40 sm:p-4">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {t.aboutDoc}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{displayDoc.description}</p>
                  </section>
                ) : null}

                <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void handleDownload(displayDoc ?? selected)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:opacity-50 sm:min-w-32"
                  >
                    {actionLoading ? (
                      <ChatbotSpinner size="sm" tone="inverse" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {t.download}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleVersions()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600/90 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:min-w-32"
                  >
                    <History className="h-4 w-4 shrink-0 text-zinc-400" />
                    {t.versions}
                  </button>
                  <button
                    type="button"
                    title={t.chatAboutDocumentHint}
                    onClick={() =>
                      router.push(
                        `/chatbot-new?doc=${encodeURIComponent(selected.id)}`
                      )
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 transition hover:border-violet-400 hover:bg-violet-100 dark:border-violet-700/70 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:border-violet-500 dark:hover:bg-violet-900/40 sm:min-w-32"
                  >
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                    {t.chatAboutDocument}
                  </button>
                </div>

                {actionError ? (
                  <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-300">{actionError}</p>
                ) : null}

                {versionsOpen ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800/90 dark:bg-zinc-950/60">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {t.versions}
                      </p>
                      {previewVersionId ? (
                        <button
                          type="button"
                          onClick={() => void loadPreview(selected.id, null)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {t.previewCurrent}
                        </button>
                      ) : null}
                    </div>
                    <div className="scrollbar-chat-hidden max-h-44 overflow-y-auto">
                      {versionsLoading ? (
                        <div className="flex justify-center py-6">
                          <ChatbotSpinner size="md" />
                        </div>
                      ) : (
                        <ul className="space-y-1.5">
                          {versions.map((v) => {
                            const active = activeRagId === v.versionId;
                            const previewing = previewVersionId === v.versionId;
                            return (
                              <li
                                key={v.versionId}
                                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                                  previewing
                                    ? "border-emerald-500/45 bg-emerald-50 dark:bg-emerald-950/20"
                                    : "border-zinc-200 bg-white dark:border-white/4 dark:bg-zinc-900/80"
                                }`}
                              >
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                  v{v.versionNumber}
                                  {active ? (
                                    <CheckCircle2
                                      className="ml-1.5 inline h-3.5 w-3.5 align-text-bottom text-emerald-400"
                                      aria-label="RAG active"
                                    />
                                  ) : null}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={previewLoading}
                                    onClick={() => void handleVersionPreview(selected.id, v.versionId)}
                                    className="shrink-0 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                  >
                                    {t.previewVersionAction}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => void handleDownload(selected, v.versionId)}
                                    className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-40 dark:bg-emerald-600/15 dark:text-emerald-300 dark:hover:bg-emerald-600/25"
                                  >
                                    {t.downloadVersionAction}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading || active || !canSetRagActive}
                                    onClick={() => void handleSetRag(selected.id, v.versionId)}
                                    className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/20 hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-40 dark:bg-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-500/30 dark:hover:bg-emerald-600/30"
                                  >
                                    {t.setRag}
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {!canSetRagActive ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                        {language === "en"
                          ? "Only admins/managers can set the active RAG version."
                          : "Chỉ quản trị/quản lý mới đổi được bản RAG active."}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950/35">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800/80 sm:px-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                    <Eye className="h-4 w-4" aria-hidden />
                  </span>
                  {t.preview}
                  {previewVersionId ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      {t.previewVersionBadge}
                    </span>
                  ) : null}
                </h3>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/90 dark:text-zinc-400">
                  {previewLoading
                    ? "…"
                    : previewError
                      ? t.previewBadgeOther
                      : preview?.kind === "text"
                        ? t.previewBadgeText
                        : preview?.kind === "pdf"
                          ? t.previewBadgePdf
                          : preview?.kind === "binary"
                            ? t.previewBadgeOther
                            : t.previewBadgeOther}
                </span>
              </div>
              <div className="scrollbar-chat-hidden flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-5">
                {previewLoading ? (
                  <ChatbotEntryLoading variant="spot" title={t.loading} className="py-14" />
                ) : previewError ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-5 text-center dark:border-amber-500/25 dark:bg-amber-950/25">
                    <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-100/90">{previewError}</p>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleDownload(displayDoc ?? selected)}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {actionLoading ? <ChatbotSpinner size="xs" tone="inverse" /> : <Download className="h-3.5 w-3.5" />}
                      {t.download}
                    </button>
                  </div>
                ) : preview?.kind === "text" && isSelectedSpreadsheet ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center dark:border-amber-500/25 dark:bg-amber-950/25">
                    <FileType className="h-10 w-10 text-amber-500" />
                    <p className="max-w-md text-sm leading-relaxed text-amber-800 dark:text-amber-100/90">
                      {language === "en"
                        ? "Excel visual preview is not shown; download/open the original to view the exact workbook. RAG uses extracted text internally."
                        : "Không hiển thị preview trực quan cho Excel; hãy tải/mở file gốc để xem đúng workbook. RAG sử dụng văn bản trích xuất nội bộ."}
                    </p>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleDownload(displayDoc ?? selected)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {actionLoading ? <ChatbotSpinner size="xs" tone="inverse" /> : <Download className="h-3.5 w-3.5" />}
                      {t.download}
                    </button>
                  </div>
                ) : preview?.kind === "text" ? (
                  <>
                    <DocumentReadablePanel label={t.previewContentTitle} className="min-h-0 flex-1">
                      <PreviewPlainText text={preview.text} />
                    </DocumentReadablePanel>
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-950/25">
                      <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">
                        <span className="font-semibold">{t.previewTextDisclaimerTitle}</span> — {t.previewTextDisclaimerBody}
                      </p>
                    </div>
                  </>
                ) : preview?.kind === "pdf" ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400">
                      {language === "en"
                        ? "Text preview is preferred; this session still has a PDF blob. Open in a new tab or download."
                        : "Ưu tiên xem trước dạng văn bản; phiên bản này vẫn là blob PDF. Mở tab mới hoặc tải xuống."}
                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-[13px] font-medium text-emerald-600 underline-offset-2 hover:text-emerald-500 hover:underline dark:text-emerald-400/95 dark:hover:text-emerald-300"
                      >
                        {t.pdfOpenNewTab}
                      </a>
                    </div>
                  </div>
                ) : preview?.kind === "binary" ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
                    <FileText className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
                    <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                      {language === "en"
                        ? `This file type (${preview.mime}) cannot be previewed here. Use Download to open it.`
                        : `Không xem trước được loại tệp (${preview.mime}). Hãy tải xuống để mở.`}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
                    <Eye className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
                    <p className="max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-500">{t.previewHint}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
            ),
            document.body
          )
        : null}
    </div>
  );
}
