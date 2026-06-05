"use client";

import { useState, useEffect } from "react";
import { Loader2, Info, UserPlus } from "lucide-react";
import { getTenantRoles, getTenantDepartments, createTenantUser, type CreateUserRequest, type RoleResponse, type DepartmentResponse } from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import { getRoleLevelDisplayLabel } from "@/lib/role-levels";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { toast } from "@/components/ui/AlertProvider";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (emailSent?: boolean) => void;
}

const SYSTEM_ROLES_TO_EXCLUDE = ['TENANT_ADMIN', 'SUPER_ADMIN', 'STAFF'];
const USER_LIMIT_ERROR_KEYWORD = "giới hạn số lượng người dùng";
const USER_LIMIT_WARNING_MESSAGE =
  "Bạn đã đạt giới hạn người dùng theo gói hiện tại. Vui lòng liên hệ quản trị để nâng cấp.";

function normalizeErrorText(value: string): string {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsMessage(source: string, keyword: string): boolean {
  return normalizeErrorText(source).includes(normalizeErrorText(keyword));
}

export function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadOptions, setLoadOptions] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorTone, setSubmitErrorTone] = useState<"warning" | "error">("error");
  const { language: lang } = useLanguageStore();

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setContactEmail("");
    setPhoneNumber("");
    setRoleId("");
    setDepartmentId("");
    setLoadOptions(true);
    setSubmitError(null);
    setSubmitErrorTone("error");
  }, [open]);

  useEffect(() => {
    if (!open || !loadOptions) return;
    Promise.all([getTenantRoles(), getTenantDepartments()])
      .then(([r, d]) => {
        setRoles(r);
        setDepartments(d);
      })
      .catch(() => {})
      .finally(() => setLoadOptions(false));
  }, [open, loadOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !contactEmail.trim()) {
      toast.warning("Họ tên và email không được để trống.");
      return;
    }
    if (roleId === "" || roleId === undefined) {
      toast.warning("Vui lòng chọn vai trò.");
      return;
    }
    setLoading(true);
    setSubmitError(null);
    setSubmitErrorTone("error");
    try {
      const cleanPhone = phoneNumber.replace(/-/g, '');
      const body: CreateUserRequest = {
        fullName: fullName.trim(),
        contactEmail: contactEmail.trim(),
        roleId: Number(roleId),
      };
      if (cleanPhone.trim()) body.phoneNumber = cleanPhone.trim();
      if (departmentId !== "") body.departmentId = Number(departmentId);
      const createdUser = await createTenantUser(body);
      onSuccess(createdUser.emailSent);
      onClose();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Tạo người dùng thất bại";
      if (containsMessage(raw, USER_LIMIT_ERROR_KEYWORD)) {
        setSubmitError(USER_LIMIT_WARNING_MESSAGE);
        setSubmitErrorTone("warning");
      } else {
        setSubmitError(raw);
        setSubmitErrorTone("error");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-950/70" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-2xl">
        {/* Gradient header */}
        <div className="shrink-0 h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500" />
        
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <UserPlus className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Tạo user mới</h3>
              <p className="text-xs text-zinc-400">Thêm nhân viên mới vào tổ chức và gán phòng ban/vai trò.</p>
            </div>
          </div>

          {submitError && (
            <div
              className={`mt-4 rounded-xl border px-3 py-2.5 text-sm ${
                submitErrorTone === "warning"
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-red-500/50 bg-red-500/10 text-red-300"
              }`}
            >
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Họ tên *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email liên hệ *</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Số điện thoại</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                Định dạng: 0xxxxxxxxx hoặc +84xxxxxxxxx (không dùng dấu gạch ngang)
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Vai trò *</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">-- Chọn --</option>
                {roles.filter((r) => !SYSTEM_ROLES_TO_EXCLUDE.some((s) => r.code?.includes(s))).map((r) => (
                  <option key={r.id} value={r.id}>{r.name ?? r.code ?? r.id}</option>
                ))}
              </select>
              {roleId !== "" && (() => {
                const selectedRole = roles.find((r) => r.id === Number(roleId));
                if (!selectedRole) return null;
                const levelLabel = getRoleLevelDisplayLabel(selectedRole.level ?? 4, lang);
                const levelNotInOptions = selectedRole.level !== undefined && selectedRole.level !== 1 && selectedRole.level !== 2 && selectedRole.level !== 3 && selectedRole.level !== 5;
                return (
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <p className="text-xs text-emerald-300">
                      <span className="font-medium">{selectedRole.name ?? selectedRole.code}</span>
                      {selectedRole.level !== undefined && selectedRole.level !== 4 && (
                        <>
                          {" — "}
                          Cấp bậc: {levelLabel}
                          {selectedRole.level < 4 && (
                            <span className="ml-1 text-amber-400">
                              (vai trò cao cấp hơn Employee)
                            </span>
                          )}
                        </>
                      )}
                      {(selectedRole.level === undefined || levelNotInOptions) && (
                        <span className="ml-1 text-zinc-400">
                          (Employee — nhân viên)
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Phòng ban</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">-- Không chọn --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name ?? d.code ?? d.id}</option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex gap-3 pt-2">
              <button 
                type="submit" 
                disabled={loading} 
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Đang tạo..." : "Tạo người dùng"}
              </button>
              <button 
                type="button" 
                onClick={onClose} 
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
