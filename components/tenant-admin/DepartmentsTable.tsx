"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, MoreVertical, Power, Loader2 } from "lucide-react";
import { ErrorNotice, useConfirmDialog } from "@/components/ui";
import { toast } from "@/components/ui/AlertProvider";
import {
  getTenantDepartments,
  getTenantActiveDepartments,
  updateTenantDepartment,
  type DepartmentResponse,
  type UpdateDepartmentRequest,
} from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";

export function DepartmentsTable({
  refreshKey = 0,
  filter,
}: {
  refreshKey?: number;
  filter: "all" | "active" | "inactive";
}) {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDept, setEditDept] = useState<DepartmentResponse | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const loadDepartments = useCallback(async () => {
    try {
      let data: DepartmentResponse[];
      if (filter === "active") {
        data = await getTenantActiveDepartments();
      } else if (filter === "inactive") {
        const all = await getTenantDepartments();
        data = all.filter((d) => !d.isActive);
      } else {
        data = await getTenantDepartments();
      }
      setDepartments(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorLoadingData);
    }
  }, [filter, t.errorLoadingData]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadDepartments().finally(() => setLoading(false));
  }, [refreshKey, loadDepartments]);

  useEffect(() => {
    if (openMenuId == null) return;
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

  const toggleMenu = (deptId: number, anchor: HTMLElement) => {
    if (openMenuId === deptId) {
      setOpenMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 200; // keep >= menu content
    const margin = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, margin),
      window.innerWidth - margin - menuWidth
    );
    setMenuPos({ top: rect.bottom + 6, left });
    setOpenMenuId(deptId);
  };

  const selectedDept = openMenuId == null
    ? null
    : departments.find((d) => d.id === openMenuId) ?? null;
  const selectedDeptActive = selectedDept?.isActive ?? false;

  const handleToggleActive = async () => {
    if (!selectedDept || openMenuId == null) return;

    const isCurrentlyActive = selectedDeptActive;
    const ok = await confirm({
      title: isCurrentlyActive
        ? language === "en"
          ? "Deactivate department?"
          : "Vô hiệu hóa phòng ban?"
        : language === "en"
          ? "Activate department?"
          : "Kích hoạt phòng ban?",
      description: isCurrentlyActive
        ? language === "en"
          ? "This department will be marked as inactive."
          : "Phòng ban này sẽ được chuyển sang trạng thái không hoạt động."
        : language === "en"
          ? "This department will be marked as active."
          : "Phòng ban này sẽ được chuyển sang trạng thái hoạt động.",
      confirmText: isCurrentlyActive
        ? t.deactivate
        : t.activate,
      cancelText: t.cancel,
      tone: isCurrentlyActive ? "danger" : "default",
    });
    if (!ok) return;

    setActionLoadingId(openMenuId);
    try {
      await updateTenantDepartment(openMenuId, { isActive: !isCurrentlyActive });
      await loadDepartments();
      setOpenMenuId(null);
      setMenuPos(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.error);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white p-8 shadow-lg dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">{t.loadingDepartments}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white p-8 shadow-lg dark:bg-zinc-950">
        <ErrorNotice message={error} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="table-scroll-container">
        <table className="min-w-176 table-auto divide-y divide-zinc-100 dark:divide-zinc-900 lg:min-w-full">
          <thead className="bg-zinc-50/50 dark:bg-zinc-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.department}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.code}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.employees}</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t.status}</th>
              <th className="relative px-6 py-4"><span className="sr-only">{t.actions}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {departments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-500">
                  {t.noDepartments}
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-4 align-top text-sm font-medium text-zinc-900 dark:text-white sm:px-6">
                    <div className="max-w-56 whitespace-normal wrap-break-word">{dept.name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                    <div className="max-w-40 whitespace-normal wrap-break-word">{dept.code ?? "—"}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-zinc-900 dark:text-white sm:px-6">{dept.employeeCount ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4 align-top sm:px-6">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        (dept.isActive ?? (filter === "active")) ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {(dept.isActive ?? (filter === "active")) ? t.active : t.inactive}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right align-top sm:px-6">
                    <button
                      type="button"
                      aria-label="Thao tác"
                      onClick={(e) => toggleMenu(dept.id, e.currentTarget)}
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openMenuId != null && menuPos != null && (
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
              onClick={() => {
                const selected = departments.find((d) => d.id === openMenuId);
                if (selected) setEditDept(selected);
                setOpenMenuId(null);
                setMenuPos(null);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-4 w-4" /> {t.edit}
            </button>
            <button
              type="button"
              onClick={() => void handleToggleActive()}
              disabled={actionLoadingId === openMenuId}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm disabled:opacity-60 ${
                selectedDeptActive
                  ? "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              }`}
            >
              <Power className="h-4 w-4" />
              {actionLoadingId === openMenuId 
                ? t.saving 
                : selectedDeptActive
                  ? t.deactivate
                  : t.activate
              }
            </button>
          </div>
        </>
      )}

      {editDept && (
        <EditDepartmentModal
          dept={editDept}
          onClose={() => setEditDept(null)}
          onSave={async (body) => {
            setEditLoading(true);
            try {
              await updateTenantDepartment(editDept.id, body);
              let data: DepartmentResponse[];
              if (filter === "active") {
                data = await getTenantActiveDepartments();
              } else if (filter === "inactive") {
                const all = await getTenantDepartments();
                data = all.filter((d) => !d.isActive);
              } else {
                data = await getTenantDepartments();
              }
              setDepartments(data);
              setEditDept(null);
            } finally {
              setEditLoading(false);
            }
          }}
          loading={editLoading}
          t={t}
        />
      )}

      {confirmDialog}
    </div>
  );
}

function EditDepartmentModal({
  dept,
  onClose,
  onSave,
  loading,
  t,
}: {
  dept: DepartmentResponse;
  onClose: () => void;
  onSave: (body: UpdateDepartmentRequest) => Promise<void>;
  loading: boolean;
  t: typeof translations.vi;
}) {
  const [code, setCode] = useState(dept.code ?? "");
  const [name, setName] = useState(dept.name ?? "");
  const [description, setDescription] = useState(dept.description ?? "");
  const [isActive, setIsActive] = useState(dept.isActive ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: UpdateDepartmentRequest = {
      code: code.trim() || undefined,
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      isActive,
    };
    await onSave(body);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-950/70" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-2xl">
        {/* Gradient header */}
        <div className="shrink-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
        
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
              <Pencil className="h-5 w-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white">{t.updateDepartment}</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t.code}</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t.name}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">{t.description}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
              />
            </div>
            
            <label className="inline-flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 cursor-pointer hover:bg-zinc-800 transition">
              <span className="text-sm font-medium text-zinc-200">{t.active}</span>
              <span className="relative inline-flex h-6 w-11 items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="absolute inset-0 rounded-full bg-zinc-700 transition peer-checked:bg-emerald-500" />
                <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </span>
            </label>

            <div className="mt-6 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:bg-purple-600 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? t.saving : t.save}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
              >
                {t.cancel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
