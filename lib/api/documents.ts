import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { DOCUMENTS_BASE } from "@/lib/api/config";
import type {
  DocumentResponse,
  DeletedDocumentResponse,
  DocumentVersionResponse,
  UpdateDocumentAccessRequest,
} from "@/types/knowledge";

type ApiRequestError = Error & {
  status?: number;
  traceId?: string | null;
  code?: string | null;
};

function extractTraceIdFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-trace-id") ??
    headers.get("trace-id") ??
    headers.get("x-request-id") ??
    null
  );
}

function createApiError(
  status: number,
  message: string,
  extras?: { traceId?: string | null; code?: string | null }
): ApiRequestError {
  const err = new Error(message) as ApiRequestError;
  err.status = status;
  if (extras?.traceId != null) err.traceId = extras.traceId;
  if (extras?.code != null) err.code = extras.code;
  return err;
}

function apiError(res: Response, message: string): ApiRequestError {
  return createApiError(res.status, message, {
    traceId: extractTraceIdFromHeaders(res.headers),
  });
}

async function parseApiError(res: Response, fallbackMessage: string): Promise<ApiRequestError> {
  const traceIdHeader = extractTraceIdFromHeaders(res.headers);
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) {
    return createApiError(res.status, fallbackMessage, { traceId: traceIdHeader });
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const message =
      typeof parsed.message === "string" && parsed.message.trim().length > 0
        ? parsed.message.trim()
        : fallbackMessage;
    const code =
      typeof parsed.code === "string" && parsed.code.trim().length > 0
        ? parsed.code.trim()
        : null;
    const traceIdBody =
      typeof parsed.traceId === "string" && parsed.traceId.trim().length > 0
        ? parsed.traceId.trim()
        : null;
    return createApiError(res.status, message, {
      traceId: traceIdHeader ?? traceIdBody,
      code,
    });
  } catch {
    return createApiError(res.status, raw.trim() || fallbackMessage, {
      traceId: traceIdHeader,
    });
  }
}

function parseFilenameFromDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim()).replace(/[\\/]/g, "_");
    } catch {
      // Fall through to plain filename if decode fails.
    }
  }

  const quotedMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim().replace(/[\\/]/g, "_");

  const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim().replace(/[\\/]/g, "_");

  return null;
}

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "text/xml",
  "application/yaml",
  "text/yaml",
  "application/x-yaml",
  "application/javascript",
  "application/x-javascript",
  "application/csv",
  "text/csv",
]);

const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "xml",
  "yaml",
  "yml",
  "log",
  "html",
  "htm",
]);

const FORCE_BINARY_EXTENSIONS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "rar",
  "7z",
]);

/** Preview mặc định theo renderer BE (ưu tiên giữ định dạng gốc/PDF, không ép text). */
const PREVIEW_QUERY = "mode=preview";
const PREVIEW_ACCEPT = "application/pdf, text/plain, text/html, application/json;q=0.9, */*;q=0.8";

function withPreviewMode(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${PREVIEW_QUERY}`;
}

function normalizeMime(contentType: string | null): string {
  return (contentType ?? "application/octet-stream").split(";")[0].trim().toLowerCase();
}

function extractFileExtension(filename: string | null): string | null {
  if (!filename) return null;
  const cleanName = filename.split("?")[0];
  const lastDot = cleanName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === cleanName.length - 1) return null;
  return cleanName.slice(lastDot + 1).toLowerCase();
}

function canPreviewAsPdf(mime: string, extension: string | null): boolean {
  return mime === "application/pdf" || extension === "pdf";
}

function canPreviewAsText(mime: string, extension: string | null): boolean {
  if (extension && FORCE_BINARY_EXTENSIONS.has(extension)) return false;
  if (mime.startsWith("text/")) return true;
  if (TEXT_MIME_TYPES.has(mime)) return true;
  if (extension && TEXT_FILE_EXTENSIONS.has(extension)) return true;
  return false;
}

export interface PreviewResponseMeta {
  etag: string | null;
  previewMode: string | null;
  sourceContentType: string | null;
  traceId: string | null;
  fromCache: boolean;
  status: number;
}

export type DocumentPreviewResponse =
  | { kind: "text"; text: string; meta: PreviewResponseMeta }
  | { kind: "pdf"; url: string; meta: PreviewResponseMeta }
  | { kind: "binary"; mime: string; meta: PreviewResponseMeta };

type CachedPreviewPayload =
  | { kind: "text"; text: string; mime: string }
  | { kind: "pdf"; blob: Blob; mime: string }
  | { kind: "binary"; blob: Blob; mime: string };

interface CachedPreviewEntry {
  etag: string | null;
  previewMode: string | null;
  sourceContentType: string | null;
  traceId: string | null;
  payload: CachedPreviewPayload;
}

const previewCache = new Map<string, CachedPreviewEntry>();

function buildPreviewResponse(
  payload: CachedPreviewPayload,
  meta: PreviewResponseMeta
): DocumentPreviewResponse {
  if (payload.kind === "text") {
    return { kind: "text", text: payload.text, meta };
  }
  if (payload.kind === "pdf") {
    return { kind: "pdf", url: URL.createObjectURL(payload.blob), meta };
  }
  return { kind: "binary", mime: payload.mime, meta };
}

function readPreviewHeaderMeta(headers: Headers): {
  etag: string | null;
  previewMode: string | null;
  sourceContentType: string | null;
  traceId: string | null;
} {
  return {
    etag: headers.get("etag"),
    previewMode: headers.get("x-preview-mode"),
    sourceContentType: headers.get("x-source-content-type"),
    traceId: extractTraceIdFromHeaders(headers),
  };
}

function toCachedPreviewMeta(entry: CachedPreviewEntry): PreviewResponseMeta {
  return {
    etag: entry.etag,
    previewMode: entry.previewMode,
    sourceContentType: entry.sourceContentType,
    traceId: entry.traceId,
    fromCache: true,
    status: 200,
  };
}

async function parsePreviewPayload(res: Response): Promise<CachedPreviewPayload> {
  const contentDisposition = res.headers.get("content-disposition");
  const filename = parseFilenameFromDisposition(contentDisposition);
  const extension = extractFileExtension(filename);
  const responseMime = normalizeMime(res.headers.get("content-type"));
  const sourceMime = normalizeMime(res.headers.get("x-source-content-type"));
  const blob = await res.blob();

  /**
   * Full text preview: ưu tiên phân loại text trước PDF.
   * Dùng cả Content-Type phản hồi và X-Source-Content-Type (Swagger preview) để không bỏ sót text/plain, json, v.v.
   */
  const treatAsText =
    canPreviewAsText(responseMime, extension) ||
    (sourceMime ? canPreviewAsText(sourceMime, extension) : false) ||
    (responseMime === "application/octet-stream" &&
      sourceMime.length > 0 &&
      (sourceMime.startsWith("text/") || canPreviewAsText(sourceMime, extension)));

  if (treatAsText) {
    return { kind: "text", text: await blob.text(), mime: responseMime };
  }

  if (canPreviewAsPdf(responseMime, extension) || sourceMime === "application/pdf") {
    return { kind: "pdf", blob, mime: responseMime };
  }

  return { kind: "binary", blob, mime: responseMime };
}

async function revalidatePreviewInBackground(url: string, etag: string): Promise<void> {
  try {
    const res = await fetchWithAuth(url, {
      headers: {
        Accept: PREVIEW_ACCEPT,
        "If-None-Match": etag,
      },
    });

    if (res.status === 304 || !res.ok) return;

    const prev = previewCache.get(url);
    const hdr = readPreviewHeaderMeta(res.headers);
    const payload = await parsePreviewPayload(res);

    previewCache.set(url, {
      etag: hdr.etag ?? prev?.etag ?? null,
      previewMode: hdr.previewMode ?? prev?.previewMode ?? null,
      sourceContentType: hdr.sourceContentType ?? payload.mime,
      traceId: hdr.traceId ?? prev?.traceId ?? null,
      payload,
    });
  } catch {
    // Best-effort refresh only; keep existing cached payload on background failure.
  }
}

async function fetchPreview(
  rawUrl: string,
  fallbackMessage: string
): Promise<DocumentPreviewResponse> {
  const url = withPreviewMode(rawUrl);
  const cached = previewCache.get(url);

  if (cached) {
    if (cached.etag) {
      void revalidatePreviewInBackground(url, cached.etag);
    }
    return buildPreviewResponse(cached.payload, toCachedPreviewMeta(cached));
  }

  const headers: Record<string, string> = { Accept: PREVIEW_ACCEPT };

  const res = await fetchWithAuth(url, { headers });

  if (res.status === 304) {
    // First fetch for this URL cannot be 304 (no If-None-Match); if cache existed we returned above.
    throw createApiError(500, "Unexpected 304 for preview without cache entry", {
      traceId: extractTraceIdFromHeaders(res.headers),
    });
  }

  if (!res.ok) {
    throw await parseApiError(res, fallbackMessage);
  }

  const hdr = readPreviewHeaderMeta(res.headers);
  const payload = await parsePreviewPayload(res);
  const meta: PreviewResponseMeta = {
    etag: hdr.etag,
    previewMode: hdr.previewMode,
    sourceContentType: hdr.sourceContentType ?? payload.mime,
    traceId: hdr.traceId,
    fromCache: false,
    status: res.status,
  };

  if (hdr.etag) {
    previewCache.set(url, {
      etag: hdr.etag,
      previewMode: hdr.previewMode,
      sourceContentType: hdr.sourceContentType ?? payload.mime,
      traceId: hdr.traceId,
      payload,
    });
  }

  return buildPreviewResponse(payload, meta);
}

export interface DownloadFileResponse {
  blob: Blob;
  filename: string | null;
  contentType: string;
  contentDisposition: string | null;
}

export interface ListDocumentsParams {
  keyword?: string;
  categoryId?: string;
  tagIds?: string[];
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export interface DocumentPermissionProbeResult {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export interface AccessScopeDepartment {
  id: number;
  name?: string;
  code?: string;
  isActive?: boolean;
}

export interface AccessScopeRole {
  id: number;
  name?: string;
  code?: string;
  isActive?: boolean;
}

export async function probeDocumentPermissions(): Promise<DocumentPermissionProbeResult> {
  let canRead = false;
  let canWrite = false;
  let canDelete = false;

  try {
    const res = await fetchWithAuth(`${DOCUMENTS_BASE}?keyword=__permission_probe__`);
    canRead = res.status !== 401 && res.status !== 403;
  } catch {
    canRead = false;
  }

  try {
    const form = new FormData();
    const res = await fetchWithAuth(`${DOCUMENTS_BASE}/upload`, {
      method: "POST",
      body: form,
    });
    canWrite = res.status !== 401 && res.status !== 403;
  } catch {
    canWrite = false;
  }

  try {
    const res = await fetchWithAuth(`${DOCUMENTS_BASE}/deleted`);
    canDelete = res.status !== 401 && res.status !== 403;
  } catch {
    canDelete = false;
  }

  return { canRead, canWrite, canDelete };
}

export async function listDocuments(params?: ListDocumentsParams): Promise<DocumentResponse[]> {
  let url = DOCUMENTS_BASE;
  
  if (params) {
    const searchParams = new URLSearchParams();
    if (params.keyword) searchParams.append('keyword', params.keyword);
    if (params.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params.tagIds && params.tagIds.length > 0) {
      params.tagIds.forEach(id => searchParams.append('tagIds', id));
    }
    if (params.status) searchParams.append('status', params.status);
    if (params.fromDate) searchParams.append('fromDate', params.fromDate);
    if (params.toDate) searchParams.append('toDate', params.toDate);
    
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  
  const res = await fetchWithAuth(url);
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Failed to list documents"));
  const data: unknown = await res.json();
  if (Array.isArray(data)) return data as DocumentResponse[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.content)) return o.content as DocumentResponse[];
    if (Array.isArray(o.data)) return o.data as DocumentResponse[];
  }
  return [];
}

export async function listAccessScopeDepartments(): Promise<AccessScopeDepartment[]> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/access-scope/departments`);
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Failed to load access scope departments"));
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => (item && typeof item === "object" ? item : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: Number(item.id),
      name: typeof item.name === "string" ? item.name : undefined,
      code: typeof item.code === "string" ? item.code : undefined,
      isActive: typeof item.isActive === "boolean" ? item.isActive : undefined,
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0);
}

export async function listAccessScopeRoles(): Promise<AccessScopeRole[]> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/access-scope/roles`);
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Failed to load access scope roles"));
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => (item && typeof item === "object" ? item : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: Number(item.id),
      name: typeof item.name === "string" ? item.name : undefined,
      code: typeof item.code === "string" ? item.code : undefined,
      isActive: typeof item.isActive === "boolean" ? item.isActive : undefined,
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0);
}

/** GET /api/v1/knowledge/documents/detail/{id} — metadata + visibility (Swagger: xem chi tiết tài liệu). */
export async function getDocument(id: string): Promise<DocumentResponse> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/detail/${id}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Document not found"));
  return res.json();
}

export async function listDeletedDocuments(): Promise<DeletedDocumentResponse[]> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/deleted`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to list deleted"));
  return res.json();
}

export async function getVersionHistory(id: string): Promise<DocumentVersionResponse[]> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/versions/${id}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to get versions"));
  return res.json();
}

export async function updateDocumentAccess(
  id: string,
  body: UpdateDocumentAccessRequest
): Promise<DocumentResponse> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/update-access/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Update failed"));
  return res.json();
}

export async function softDeleteDocument(id: string): Promise<void> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text().catch(() => "Delete failed"));
}

export async function restoreDocument(id: string): Promise<void> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/${id}/restore`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text().catch(() => "Restore failed"));
}

export interface UploadDocumentParams {
  file: File;
  categoryId?: string | null;
  tagIds?: string[] | null;
  description?: string | null;
  /** 1–5, mặc định 4 */
  minimumRoleLevel?: number;
  visibility?: "COMPANY_WIDE" | "SPECIFIC_DEPARTMENTS" | "SPECIFIC_ROLES" | "SPECIFIC_DEPARTMENTS_AND_ROLES";
  accessibleDepartments?: number[] | null;
  accessibleRoles?: number[] | null;
}

export async function uploadDocument(params: UploadDocumentParams): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("file", params.file);
  if (params.categoryId) form.append("categoryId", params.categoryId);
  if (params.tagIds?.length) params.tagIds.forEach((id) => form.append("tagIds", id));
  if (params.description != null) form.append("description", params.description);
  form.append("visibility", params.visibility ?? "COMPANY_WIDE");
  if (params.accessibleDepartments?.length) {
    params.accessibleDepartments.forEach((d) => form.append("accessibleDepartments", String(d)));
  }
  if (params.accessibleRoles?.length) {
    params.accessibleRoles.forEach((r) => form.append("accessibleRoles", String(r)));
  }
  form.append("minimumRoleLevel", String(params.minimumRoleLevel ?? 4));
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Upload failed"));
  return res.json();
}

export interface UploadNewVersionParams {
  documentId: string;
  file: File;
  versionNote?: string | null;
  documentTitle?: string | null;
}

export async function uploadNewVersion(
  params: UploadNewVersionParams
): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("file", params.file);
  if (params.versionNote != null) form.append("versionNote", params.versionNote);
  if (params.documentTitle != null) form.append("documentTitle", params.documentTitle);
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/update/${params.documentId}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Upload version failed"));
  return res.json();
}

export type ActiveRagVersionResponse = {
  document_id: string;
  active_version_id: string | null;
  version_number?: number;
  version_note?: string | null;
  created_at?: string;
};

/**
 * GET /api/v1/knowledge/documents/{id}/content?mode=preview — toàn bộ nội dung để hiển thị (text/PDF; Swagger: xem trực tiếp).
 * Caller must revoke PDF object URLs from the response.
 */
export async function getDocumentPreview(id: string): Promise<DocumentPreviewResponse> {
  return fetchPreview(`${DOCUMENTS_BASE}/${id}/content`, "Failed to load document preview");
}

export async function downloadDocument(id: string): Promise<DownloadFileResponse> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/${id}/download`);
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Download failed"));
  const contentDisposition = res.headers.get("content-disposition");
  const blob = await res.blob();
  return {
    blob,
    filename: parseFilenameFromDisposition(contentDisposition),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    contentDisposition,
  };
}

export async function getDocumentDownloadUrl(id: string): Promise<{ url: string; expiresInMinutes: string }> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/${id}/url`);
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Failed to get download URL"));
  return res.json();
}

export async function reindexDocument(id: string): Promise<{ message: string; documentId: string; status: string }> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/${id}/reindex`, { method: "POST" });
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Failed to reindex document"));
  return res.json();
}

export async function getDocumentVersionPreview(
  documentId: string,
  versionId: string
): Promise<DocumentPreviewResponse> {
  return fetchPreview(
    `${DOCUMENTS_BASE}/${documentId}/versions/${versionId}/content`,
    "Failed to load version preview"
  );
}

export async function downloadDocumentVersion(
  documentId: string,
  versionId: string
): Promise<DownloadFileResponse> {
  const res = await fetchWithAuth(
    `${DOCUMENTS_BASE}/${documentId}/versions/${versionId}/download`
  );
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Download failed"));
  const contentDisposition = res.headers.get("content-disposition");
  const blob = await res.blob();
  return {
    blob,
    filename: parseFilenameFromDisposition(contentDisposition),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    contentDisposition,
  };
}

export async function getActiveRagVersion(documentId: string): Promise<ActiveRagVersionResponse> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/${documentId}/rag-version`);
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Failed to load RAG version"));
  return res.json();
}

export async function setActiveRagVersion(documentId: string, versionId: string): Promise<void> {
  const res = await fetchWithAuth(`${DOCUMENTS_BASE}/${documentId}/rag-version/${versionId}`, {
    method: "PUT",
  });
  if (!res.ok) throw apiError(res, await res.text().catch(() => "Failed to set RAG version"));
}
