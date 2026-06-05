"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getStaffList,
  getStaffById,
  createStaff,
  activateStaff,
  deactivateStaff,
  deleteStaff,
  type StaffUser,
  type CreateStaffRequest,
} from "@/lib/api/admin";
import { UserPlus, MoreVertical, Eye, UserCheck, UserX, Trash2, Loader2, Search } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { ErrorNotice, useConfirmDialog } from "@/components/ui";
import { toast } from "@/lib/notification-store";

export default function StaffManagementPage() {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [list, setList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<StaffUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const { confirm, confirmDialog } = useConfirmDialog();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getStaffList()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : isEn ? "Failed to load list" : "Lỗi tải danh sách"))
      .finally(() => setLoading(false));
  }, [isEn]);

  useEffect(() => {
    let alive = true;
    getStaffList()
      .then((data) => {
        if (!alive) return;
        setList(data);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : isEn ? "Failed to load list" : "Lỗi tải danh sách");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isEn]);

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

  const toggleMenu = (staffId: string, anchor: HTMLElement) => {
    if (openMenuId === staffId) {
      setOpenMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 192; // w-48
    const margin = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, margin),
      window.innerWidth - margin - menuWidth
    );
    setMenuPos({ top: rect.bottom + 6, left });
    setOpenMenuId(staffId);
  };

  const handleActivate = (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    activateStaff(userId)
      .then(load)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Lỗi"))
      .finally(() => setActionLoading(null));
  };

  const handleDeactivate = (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    deactivateStaff(userId)
      .then(load)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Lỗi"))
      .finally(() => setActionLoading(null));
  };

  const handleDelete = async (userId: string) => {
    const ok = await confirm({
      title: isEn ? "Delete STAFF account?" : "Xóa tài khoản STAFF?",
      description: isEn
        ? "Are you sure you want to delete this STAFF account?"
        : "Bạn có chắc muốn xóa tài khoản nhân viên vận hành này?",
      confirmText: isEn ? "Delete" : "Xóa",
      cancelText: isEn ? "Cancel" : "Hủy",
      tone: "danger",
    });
    if (!ok) return;

    setOpenMenuId(null);
    setMenuPos(null);
    setActionLoading(userId);
    deleteStaff(userId)
      .then(load)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Lỗi"))
      .finally(() => setActionLoading(null));
  };

  const handleViewDetail = (userId: string) => {
    setOpenMenuId(null);
    setMenuPos(null);
    getStaffById(userId)
      .then(setDetailUser)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Lỗi"));
  };

  const filtered = search.trim()
    ? list.filter(
        (s) =>
          (s.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (s.email ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : list;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{isEn ? "Staff Management" : "Quản lý nhân viên vận hành"}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {isEn ? "Create, view, activate/deactivate, and delete STAFF accounts" : "Tạo, xem, kích hoạt / vô hiệu hóa, xóa tài khoản nhân viên vận hành"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
          >
            <UserPlus className="h-4 w-4" />
            {isEn ? "Add Staff" : "Thêm nhân viên"}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder={isEn ? "Search by name or email..." : "Tìm theo tên hoặc email..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border-0 bg-zinc-50 py-2 pl-10 pr-4 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:ring-2 focus:ring-green-500 dark:bg-zinc-900/50 dark:text-white dark:ring-zinc-800"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
              <span className="text-sm text-zinc-500">{isEn ? "Loading..." : "Đang tải…"}</span>
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorNotice message={error} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">{isEn ? "Name / Email" : "Tên / Email"}</th>
                    <th className="px-6 py-4 font-medium">{isEn ? "Phone" : "SĐT"}</th>
                    <th className="px-6 py-4 font-medium">{isEn ? "Status" : "Trạng thái"}</th>
                    <th className="px-6 py-4 font-medium text-right">{isEn ? "Actions" : "Thao tác"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-zinc-500">
                        {isEn ? 'No staff yet. Click "Add Staff" to create one.' : 'Chưa có nhân viên vận hành. Bấm "Thêm nhân viên" để tạo.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((staff) => (
                      <tr key={staff.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">{staff.fullName ?? "—"}</p>
                            <p className="text-xs text-zinc-500">{staff.email ?? "—"}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{staff.phoneNumber ?? "—"}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                              staff.isActive
                                ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400"
                                : "bg-zinc-50 text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${staff.isActive ? "bg-green-500" : "bg-zinc-400"}`} />
                            {staff.isActive ? "Active" : isEn ? "Inactive" : "Vô hiệu hóa"}
                          </span>
                        </td>
                        <td className="relative px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => toggleMenu(staff.id, e.currentTarget)}
                            className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                          {actionLoading === staff.id && (
                            <span className="absolute right-10 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateStaffModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={() => setDetailUser(null)} />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
            {/* HEADER */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-600 px-8 py-8 dark:from-indigo-600 dark:to-indigo-700">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                    <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {detailUser.fullName ?? "Staff Member"}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-sm text-indigo-50">Staff Details</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${
                        detailUser.isActive ? 'bg-green-500/30 text-white' : 'bg-red-500/30 text-white'
                      }`}>
                        {detailUser.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDetailUser(null)}
                  className="rounded-xl bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="space-y-6 p-8">
              {/* Contact Info Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Email Card */}
                <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Email
                    </h4>
                  </div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {detailUser.email ?? "—"}
                  </p>
                </div>

                {/* Phone Card */}
                <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                  <div className="mb-3 flex items-center gap-2">
                    <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Phone
                    </h4>
                  </div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {detailUser.phoneNumber ?? "—"}
                  </p>
                </div>
              </div>

              {/* Status & Date Card */}
              <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
                <div className="mb-4 flex items-center gap-2">
                  <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Account Information
                  </h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Status</span>
                    <p className={`mt-1 text-sm font-semibold ${
                      detailUser.isActive 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {detailUser.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Created Date</span>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleDateString("vi-VN") : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-end border-t border-zinc-200 bg-zinc-50 px-8 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:shadow-white/20 dark:hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {openMenuId && menuPos && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpenMenuId(null);
              setMenuPos(null);
            }}
          />
          <div
            className="fixed z-50 w-48 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={() => handleViewDetail(openMenuId)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Eye className="h-4 w-4" /> {isEn ? "View details" : "Xem chi tiết"}
            </button>
            {list.find((s) => s.id === openMenuId)?.isActive ? (
              <button
                type="button"
                onClick={() => handleDeactivate(openMenuId)}
                disabled={!!actionLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:text-amber-400 dark:hover:bg-amber-950/30"
              >
                <UserX className="h-4 w-4" /> {isEn ? "Deactivate" : "Vô hiệu hóa"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleActivate(openMenuId)}
                disabled={!!actionLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 disabled:opacity-60 dark:text-green-400 dark:hover:bg-green-950/30"
              >
                <UserCheck className="h-4 w-4" /> {isEn ? "Activate" : "Kích hoạt"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDelete(openMenuId)}
              disabled={!!actionLoading}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-4 w-4" /> {isEn ? "Delete" : "Xóa"}
            </button>
          </div>
        </>
      )}

      {confirmDialog}
    </>
  );
}

function CreateStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Helper functions for phone validation (same as profile page)
  const onlyDigits = (input: string): string => input.replace(/\D/g, "");
  
  const validatePhone = (phoneInput: string): string | null => {
    if (!phoneInput.trim()) return null; // Optional field
    
    const digits = onlyDigits(phoneInput);
    
    // Must be exactly 10 digits
    if (digits.length !== 10) {
      return isEn 
        ? "Phone number must be exactly 10 digits" 
        : "Số điện thoại phải có đúng 10 chữ số";
    }
    
    // Must start with 0
    if (!digits.startsWith("0")) {
      return isEn 
        ? "Phone number must start with 0" 
        : "Số điện thoại phải bắt đầu bằng số 0";
    }
    
    return null; // Valid
  };

  const normalizeVietnamPhone = (phoneInput: string): string | null => {
    if (!phoneInput.trim()) return null;
    const digits = onlyDigits(phoneInput);
    if (digits.length === 10 && digits.startsWith("0")) {
      return `+84${digits.slice(1)}`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!email.trim() || !fullName.trim()) {
      setError(isEn ? "Email and full name are required" : "Email và họ tên không được để trống");
      return;
    }

    // Validate phone if provided
    if (phone.trim()) {
      const phoneError = validatePhone(phone);
      if (phoneError) {
        setError(phoneError);
        return;
      }
    }

    setLoading(true);
    try {
      const body: CreateStaffRequest = { 
        contactEmail: email.trim(), 
        fullName: fullName.trim() 
      };
      
      // Normalize phone to +84 format if provided
      const normalizedPhone = normalizeVietnamPhone(phone);
      if (normalizedPhone) {
        body.phone = normalizedPhone;
      }
      
      const data = await createStaff(body);
      
      if (data.emailSent === false) {
        setSuccess(
          isEn 
            ? "Staff account created successfully. However, login email could not be sent (check SMTP configuration)." 
            : "Tài khoản STAFF đã được tạo thành công. Tuy nhiên không gửi được email thông tin đăng nhập (kiểm tra cấu hình SMTP phía server)."
        );
      } else {
        setSuccess(
          isEn 
            ? "Staff account created successfully. Login credentials have been sent via email." 
            : "Tài khoản STAFF đã được tạo. Email thông tin đăng nhập đã được gửi."
        );
      }
      
      // Close modal after 2 seconds
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : (isEn ? "Failed to create staff account" : "Tạo tài khoản nhân viên vận hành thất bại"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-900/80 dark:bg-black/90" onClick={onClose} />
      <div className="relative w-full max-w-md animate-scale-in rounded-3xl border border-zinc-200/50 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Gradient Header */}
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-6 py-8">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              {isEn ? "Create Staff Account" : "Tạo tài khoản nhân viên"}
            </h3>
            <p className="mt-2 text-sm text-emerald-50">
              {isEn 
                ? "Create a new staff account to manage the system" 
                : "Tạo mới tài khoản nhân viên để quản trị hệ thống"}
            </p>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {success}
            </div>
          )}

          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="staff@example.com"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-emerald-400"
              />
            </div>

            {/* Full Name Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isEn ? "Full Name" : "Họ tên"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder={isEn ? "Nguyen Van A" : "Nguyễn Văn A"}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-emerald-400"
              />
            </div>

            {/* Phone Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isEn ? "Phone Number" : "Số điện thoại"} 
                <span className="ml-2 text-xs font-normal text-zinc-400">
                  ({isEn ? "Optional" : "Tùy chọn"})
                </span>
              </label>
              <div className="flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800">
                <span className="inline-flex items-center border-r border-zinc-200 bg-zinc-100 px-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  +84
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 10))}
                  placeholder="0123456789"
                  className="w-full border-0 bg-transparent px-3 py-2.5 text-sm text-zinc-900 outline-none dark:text-white"
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                {isEn 
                  ? "Must be 10 digits starting with 0 (e.g., 0123456789)" 
                  : "Phải có 10 chữ số và bắt đầu bằng số 0 (vd: 0123456789)"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={loading || !!success}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEn ? "Creating..." : "Đang tạo..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {isEn ? "Create" : "Tạo"}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {isEn ? "Cancel" : "Hủy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
