"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Search, Download, Trash2, Calendar, History, RefreshCw, X } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { 
  listDocuments, 
  downloadDocument,
  uploadDocument, 
  softDeleteDocument,
  getVersionHistory,
  uploadNewVersion,
  type UploadDocumentParams,
  type UploadNewVersionParams
} from "@/lib/api/documents";
import type { DocumentResponse, DocumentVersionResponse, DocumentCategoryResponse, DocumentTagResponse } from "@/types/knowledge";
import { getTenantActiveDepartments, getTenantRoles, type DepartmentResponse, type RoleResponse } from "@/lib/api/tenant-admin";
import { listCategoriesFlat } from "@/lib/api/categories";
import { listTagsActive } from "@/lib/api/tags";
import { ChatbotEntryLoading, ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";

export function KnowledgeBaseView() {
  const { language } = useLanguageStore();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Categories, Tags, Departments and Roles
  const [categories, setCategories] = useState<DocumentCategoryResponse[]>([]);
  const [tags, setTags] = useState<DocumentTagResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [showUpdateVersionModal, setShowUpdateVersionModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Selected items
  const [selectedDocument, setSelectedDocument] = useState<DocumentResponse | null>(null);
  const [versionHistory, setVersionHistory] = useState<DocumentVersionResponse[]>([]);
  
  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategoryId, setUploadCategoryId] = useState<string>("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<"COMPANY_WIDE" | "SPECIFIC_DEPARTMENTS" | "SPECIFIC_ROLES" | "SPECIFIC_DEPARTMENTS_AND_ROLES">("COMPANY_WIDE");
  const [uploadTagIds, setUploadTagIds] = useState<string[]>([]);
  const [uploadDepartments, setUploadDepartments] = useState<number[]>([]);
  const [uploadRoles, setUploadRoles] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Update version form
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [versionNote, setVersionNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const [docs, cats, activeTags, depts, tenantRoles] = await Promise.all([
        listDocuments(),
        listCategoriesFlat().catch(() => []),
        listTagsActive().catch(() => []),
        getTenantActiveDepartments().catch(() => []),
        getTenantRoles().catch(() => []),
      ]);
      setDocuments(docs);
      setCategories(cats);
      setTags(activeTags);
      setDepartments(depts);
      setRoles(tenantRoles);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    
    try {
      setUploading(true);
      const params: UploadDocumentParams = {
        file: uploadFile,
        categoryId: uploadCategoryId || null,
        description: uploadDescription || null,
        visibility: uploadVisibility,
        tagIds: uploadTagIds.length > 0 ? uploadTagIds : null,
        accessibleDepartments: (uploadVisibility === "SPECIFIC_DEPARTMENTS" || uploadVisibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && uploadDepartments.length > 0 ? uploadDepartments : null,
        accessibleRoles: (uploadVisibility === "SPECIFIC_ROLES" || uploadVisibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && uploadRoles.length > 0 ? uploadRoles : null,
      };
      
      await uploadDocument(params);
      setShowUploadModal(false);
      resetUploadForm();
      loadDocuments();
    } catch (error) {
      console.error("Upload failed:", error);
      alert(language === "en" ? "Upload failed" : "Tải lên thất bại");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;
    
    try {
      await softDeleteDocument(selectedDocument.id);
      setShowDeleteConfirm(false);
      setSelectedDocument(null);
      loadDocuments();
    } catch (error) {
      console.error("Delete failed:", error);
      alert(language === "en" ? "Delete failed" : "Xóa thất bại");
    }
  };

  const handleViewHistory = async (doc: DocumentResponse) => {
    try {
      setSelectedDocument(doc);
      const history = await getVersionHistory(doc.id);
      setVersionHistory(history);
      setShowVersionHistoryModal(true);
    } catch (error) {
      console.error("Failed to load version history:", error);
    }
  };

  const handleUpdateVersion = async () => {
    if (!selectedDocument || !updateFile) return;
    
    try {
      setUpdating(true);
      const params: UploadNewVersionParams = {
        documentId: selectedDocument.id,
        file: updateFile,
        versionNote: versionNote || null,
      };
      
      await uploadNewVersion(params);
      setShowUpdateVersionModal(false);
      resetUpdateForm();
      loadDocuments();
    } catch (error) {
      console.error("Update version failed:", error);
      alert(language === "en" ? "Update failed" : "Cập nhật thất bại");
    } finally {
      setUpdating(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadCategoryId("");
    setUploadDescription("");
    setUploadVisibility("COMPANY_WIDE");
    setUploadTagIds([]);
    setUploadDepartments([]);
    setUploadRoles([]);
  };

  const resetUpdateForm = () => {
    setUpdateFile(null);
    setVersionNote("");
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.originalFileName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    return matchesSearch;
  });

  const handleDownload = async (doc: DocumentResponse) => {
    setDownloadingId(doc.id);
    try {
      const file = await downloadDocument(doc.id);
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename ?? doc.originalFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      alert(language === "en" ? "Download failed" : "Tải xuống thất bại");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 px-8 py-6 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {language === "en" ? "Document Dashboard" : "Document Dashboard"}
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {language === "en" 
                  ? "Manage and organize your company documents" 
                  : "Quản lý và tổ chức tài liệu công ty"}
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <Upload className="h-4 w-4" />
              {language === "en" ? "Upload Document" : "Tải lên tài liệu"}
            </button>
          </div>

          {/* Search */}
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "en" ? "Search documents..." : "Tìm kiếm tài liệu..."}
                className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="scrollbar-chat-hidden flex-1 overflow-y-auto scroll-smooth px-8 py-6">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="flex min-h-[16rem] items-center justify-center py-8">
              <ChatbotEntryLoading
                variant="panel"
                title={language === "en" ? "Loading documents" : "Đang tải tài liệu"}
                subtitle={language === "en" ? "Fetching your library…" : "Đang lấy thư viện tài liệu…"}
              />
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {language === "en" 
                  ? `${filteredDocuments.length} documents found` 
                  : `Tìm thấy ${filteredDocuments.length} tài liệu`}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="group rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
                  >
                    {/* Document Icon */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                        <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {doc.fileType}
                      </span>
                    </div>

                    {/* Document Name */}
                    <h3 className="mb-2 truncate text-sm font-semibold text-zinc-900 dark:text-white">
                      {doc.documentTitle || doc.originalFileName}
                    </h3>

                    {/* Metadata */}
                    <div className="mb-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(doc.uploadedAt).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}</span>
                      </div>
                      <div className="text-zinc-500">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                      {doc.chunkCount && (
                        <div className="text-zinc-500">{doc.chunkCount} chunks</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                        title={language === "en" ? "Download" : "Tải xuống"}
                      >
                        {downloadingId === doc.id ? (
                          <ChatbotSpinner size="xs" tone="inverse" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleViewHistory(doc)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        title={language === "en" ? "History" : "Lịch sử"}
                      >
                        <History className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDocument(doc);
                          setShowUpdateVersionModal(true);
                        }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:bg-green-950/50 dark:text-green-400 dark:hover:bg-green-950"
                        title={language === "en" ? "Update" : "Cập nhật"}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDocument(doc);
                          setShowDeleteConfirm(true);
                        }}
                        className="flex items-center justify-center rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950"
                        title={language === "en" ? "Delete" : "Xóa"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredDocuments.length === 0 && (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-zinc-400" />
                    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {language === "en" ? "No documents found" : "Không tìm thấy tài liệu"}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUploadModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {language === "en" ? "Upload Document" : "Tải lên tài liệu"}
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-zinc-500 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* File Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "File" : "Tệp tin"}
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept=".pdf,.docx,.xlsx,.txt,.md,.csv"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "Category" : "Danh mục"}
                </label>
                <select
                  value={uploadCategoryId}
                  onChange={(e) => setUploadCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">— {language === "en" ? "No category" : "Không chọn"} —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "Tags" : "Thẻ"}
                </label>
                <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
                  {tags.length === 0 ? (
                    <span className="px-2 py-1 text-xs text-zinc-500">
                      {language === "en" ? "No tags available" : "Chưa có thẻ"}
                    </span>
                  ) : (
                    tags.map((tag) => {
                      const active = uploadTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setUploadTagIds((prev) =>
                              prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]
                            );
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                          }`}
                          title={`${tag.name} (${tag.code})`}
                        >
                          {tag.name} ({tag.code})
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {language === "en" ? "Selected: " : "Đã chọn: "}{uploadTagIds.length}
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "Description" : "Mô tả"}
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder={language === "en" ? "Optional description" : "Mô tả (tùy chọn)"}
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "Access Scope" : "Phạm vi truy cập"}
                </label>
                <select
                  value={uploadVisibility}
                  onChange={(e) => setUploadVisibility(e.target.value as typeof uploadVisibility)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="COMPANY_WIDE">{language === "en" ? "Company Wide" : "Toàn công ty"}</option>
                  <option value="SPECIFIC_DEPARTMENTS">{language === "en" ? "By Department" : "Theo phòng ban"}</option>
                  <option value="SPECIFIC_ROLES">{language === "en" ? "By Role" : "Theo vai trò"}</option>
                  <option value="SPECIFIC_DEPARTMENTS_AND_ROLES">{language === "en" ? "By Department AND Role" : "Theo phòng ban VÀ vai trò"}</option>
                </select>
              </div>

              {/* Departments - show when SPECIFIC_DEPARTMENTS or SPECIFIC_DEPARTMENTS_AND_ROLES */}
              {(uploadVisibility === "SPECIFIC_DEPARTMENTS" || uploadVisibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {language === "en" ? "Select Departments" : "Chọn phòng ban"}
                  </label>
                  <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
                    {departments.length === 0 ? (
                      <span className="px-2 py-1 text-xs text-zinc-500">
                        {language === "en" ? "No active departments" : "Chưa có phòng ban đang hoạt động"}
                      </span>
                    ) : (
                      departments.map((d) => {
                        const active = uploadDepartments.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setUploadDepartments((prev) =>
                                prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                              );
                            }}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                              active
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
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
                    {language === "en" ? "Selected: " : "Đã chọn: "}{uploadDepartments.length}
                  </p>
                </div>
              )}

              {/* Roles - show when SPECIFIC_ROLES or SPECIFIC_DEPARTMENTS_AND_ROLES */}
              {(uploadVisibility === "SPECIFIC_ROLES" || uploadVisibility === "SPECIFIC_DEPARTMENTS_AND_ROLES") && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {language === "en" ? "Select Roles" : "Chọn vai trò"}
                  </label>
                  <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
                    {roles.length === 0 ? (
                      <span className="px-2 py-1 text-xs text-zinc-500">
                        {language === "en" ? "No roles available" : "Chưa có vai trò"}
                      </span>
                    ) : (
                      roles.map((r) => {
                        const active = uploadRoles.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setUploadRoles((prev) =>
                                prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                              );
                            }}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                              active
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
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
                    {language === "en" ? "Selected: " : "Đã chọn: "}{uploadRoles.length}
                  </p>
                </div>
              )}

              {/* Tags - removed old text input */}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {language === "en" ? "Cancel" : "Hủy"}
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {uploading 
                  ? (language === "en" ? "Uploading..." : "Đang tải lên...") 
                  : (language === "en" ? "Upload" : "Tải lên")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Version History Modal */}
      {showVersionHistoryModal && selectedDocument && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowVersionHistoryModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {language === "en" ? "Version History" : "Lịch sử phiên bản"}
              </h3>
              <button onClick={() => setShowVersionHistoryModal(false)} className="text-zinc-500 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-zinc-900 dark:text-white">{selectedDocument.documentTitle || selectedDocument.originalFileName}</h4>
            </div>

            <div className="scrollbar-chat-hidden max-h-96 space-y-3 overflow-y-auto">
              {versionHistory.length > 0 ? versionHistory.map((version) => (
                <div key={version.versionId} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          v{version.versionNumber}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {version.versionNote || (language === "en" ? "No notes" : "Không có ghi chú")}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                        <span>{new Date(version.createdAt).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-center text-sm text-zinc-500">
                  {language === "en" ? "No version history available" : "Không có lịch sử phiên bản"}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Update Version Modal */}
      {showUpdateVersionModal && selectedDocument && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUpdateVersionModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {language === "en" ? "Upload New Version" : "Tải lên phiên bản mới"}
              </h3>
              <button onClick={() => setShowUpdateVersionModal(false)} className="text-zinc-500 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {selectedDocument.documentTitle || selectedDocument.originalFileName}
              </p>
            </div>
            
            <div className="space-y-4">
              {/* File Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "New File" : "Tệp tin mới"}
                </label>
                <input
                  type="file"
                  onChange={(e) => setUpdateFile(e.target.files?.[0] || null)}
                  accept=".pdf,.docx,.xlsx,.txt,.md,.csv"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>

              {/* Version Note */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {language === "en" ? "Version Note" : "Ghi chú phiên bản"}
                </label>
                <textarea
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder={language === "en" ? "What changed in this version?" : "Thay đổi gì trong phiên bản này?"}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowUpdateVersionModal(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {language === "en" ? "Cancel" : "Hủy"}
              </button>
              <button
                onClick={handleUpdateVersion}
                disabled={!updateFile || updating}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {updating 
                  ? (language === "en" ? "Updating..." : "Đang cập nhật...") 
                  : (language === "en" ? "Update" : "Cập nhật")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedDocument && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
              {language === "en" ? "Delete Document?" : "Xóa tài liệu?"}
            </h3>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {language === "en" 
                ? `Are you sure you want to delete "${selectedDocument.documentTitle || selectedDocument.originalFileName}"? This action can be undone from the deleted documents list.`
                : `Bạn có chắc muốn xóa "${selectedDocument.documentTitle || selectedDocument.originalFileName}"? Hành động này có thể hoàn tác từ danh sách tài liệu đã xóa.`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {language === "en" ? "Cancel" : "Hủy"}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                {language === "en" ? "Delete" : "Xóa"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
