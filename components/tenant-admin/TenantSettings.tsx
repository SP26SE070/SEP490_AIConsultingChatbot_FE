"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Building2, Trash2, Image as ImageIcon } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { getTenantInfo, updateTenantProfile, uploadTenantLogo, deleteTenantLogo, type TenantInfoResponse } from "@/lib/api/tenant-settings";
import { Button } from "@/components/ui";

export function TenantSettings() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";

  const [tenantInfo, setTenantInfo] = useState<TenantInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTenantInfo();
  }, []);

  const loadTenantInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantInfo();
      setTenantInfo(data);
      if (data.additionalLogoUrl) {
        setLogoPreview(data.additionalLogoUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to load tenant info" : "Không thể tải thông tin tenant");
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    setError(null);

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      setError(isEn ? "Only PNG and JPG images are allowed" : "Chỉ chấp nhận file PNG và JPG");
      return;
    }

    // Validate file size (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(isEn ? "File size must be less than 2MB" : "Kích thước file phải nhỏ hơn 2MB");
      return;
    }

    setSelectedLogo(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!selectedLogo) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadTenantLogo(selectedLogo);
      setLogoPreview(result.additionalLogoUrl);
      setSelectedLogo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSuccess(isEn ? "Logo uploaded successfully" : "Tải logo lên thành công");
      await loadTenantInfo();
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to upload logo" : "Tải logo lên thất bại");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm(isEn ? "Are you sure you want to delete the logo?" : "Bạn có chắc muốn xóa logo?")) {
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteTenantLogo();
      setLogoPreview(null);
      setSelectedLogo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSuccess(isEn ? "Logo deleted successfully" : "Xóa logo thành công");
      await loadTenantInfo();
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to delete logo" : "Xóa logo thất bại");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isEn ? "Loading..." : "Đang tải..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          {success}
        </div>
      )}

      {/* Tenant Profile Section - Read Only */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {isEn ? "Organization Information" : "Thông tin tổ chức"}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isEn ? "View your organization details" : "Xem thông tin tổ chức của bạn"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Organization Name */}
          {tenantInfo?.name && (
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isEn ? "Organization Name" : "Tên tổ chức"}
              </label>
              <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {tenantInfo.name}
              </div>
            </div>
          )}

          {/* Address */}
          {tenantInfo?.address && (
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isEn ? "Address" : "Địa chỉ"}
              </label>
              <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {tenantInfo.address}
              </div>
            </div>
          )}

          {/* Website */}
          {tenantInfo?.website && (
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isEn ? "Website" : "Website"}
              </label>
              <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <a 
                  href={tenantInfo.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {tenantInfo.website}
                </a>
              </div>
            </div>
          )}

          {/* Company Size */}
          {tenantInfo?.companySize && (
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isEn ? "Company Size" : "Quy mô công ty"}
              </label>
              <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {tenantInfo.companySize}
              </div>
            </div>
          )}

          {/* Note about backend API */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
            <p className="font-medium">
              {isEn ? "⚠️ Profile editing is temporarily unavailable" : "⚠️ Chỉnh sửa thông tin tạm thời không khả dụng"}
            </p>
            <p className="mt-1 text-xs">
              {isEn 
                ? "The backend API for updating profile information is not yet available. Please contact your administrator." 
                : "API backend để cập nhật thông tin chưa khả dụng. Vui lòng liên hệ quản trị viên."}
            </p>
          </div>
        </div>
      </div>

      {/* Logo Upload Section */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {isEn ? "Organization Logo" : "Logo tổ chức"}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isEn ? "Upload your organization logo (PNG/JPG, max 2MB)" : "Tải lên logo tổ chức (PNG/JPG, tối đa 2MB)"}
            </p>
          </div>
        </div>

        {/* Current Logo Preview */}
        {logoPreview && !selectedLogo && (
          <div className="mb-6">
            <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isEn ? "Current Logo" : "Logo hiện tại"}
            </p>
            <div className="relative inline-block">
              <img
                src={logoPreview}
                alt="Current logo"
                className="h-32 w-32 rounded-xl border-2 border-zinc-200 object-contain dark:border-zinc-700"
              />
              <button
                type="button"
                onClick={handleDeleteLogo}
                disabled={uploading}
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Drag & Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all ${
            isDragging
              ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-950/30"
              : selectedLogo
                ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-700 dark:bg-emerald-950/20"
                : "border-zinc-300 bg-zinc-50/50 hover:border-emerald-400 hover:bg-emerald-50/30 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {!selectedLogo ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-transform group-hover:scale-110 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Upload className="h-8 w-8" />
              </div>
              <p className="mb-2 text-base font-medium text-zinc-900 dark:text-white">
                {isEn ? "Drag & drop your logo here" : "Kéo thả logo vào đây"}
              </p>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                {isEn ? "or click to browse" : "hoặc nhấp để chọn"}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {isEn ? "PNG or JPG (max 2MB)" : "PNG hoặc JPG (tối đa 2MB)"}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-6">
              <img
                src={logoPreview || ""}
                alt="Logo preview"
                className="h-20 w-20 rounded-lg border-2 border-zinc-200 object-contain dark:border-zinc-700"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                  {selectedLogo.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {(selectedLogo.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLogo(null);
                  setLogoPreview(tenantInfo?.logoUrl || null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Upload Button */}
        {selectedLogo && (
          <div className="mt-4">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleUploadLogo}
              disabled={uploading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? (isEn ? "Uploading..." : "Đang tải lên...") : (isEn ? "Upload Logo" : "Tải lên logo")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
