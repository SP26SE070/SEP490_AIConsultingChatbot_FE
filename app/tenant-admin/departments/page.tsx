 "use client";

import { useState } from "react";
import { DepartmentsTable } from "@/components/tenant-admin/DepartmentsTable";
import { Filter, Plus } from "lucide-react";
import { createTenantDepartment } from "@/lib/api/tenant-admin";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { AnimatedSegmentedControl } from "@/components/ui";

export default function DepartmentsPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t.manageDepartments}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {t.organizationStructure}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <Filter className="h-4 w-4" />
            {language === "en" ? "Filters" : "Bộ lọc"}
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-500/40"
          >
            <Plus className="h-4 w-4" />
            {t.addDepartment}
          </button>
        </div>

        <AnimatedSegmentedControl
          value={filter}
          onChange={setFilter}
          layoutId="departments-filter-pill"
          options={[
            { value: "all", label: t.allDepartments },
            { value: "active", label: t.activeDepartments },
            { value: "inactive", label: language === "en" ? "Inactive" : "Không hoạt động" },
          ]}
        />

        <div className="min-w-0">
          <DepartmentsTable refreshKey={refreshKey} filter={filter} />
        </div>
      </div>

      {createOpen && (
        <CreateDepartmentModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

function CreateDepartmentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError("Vui lòng nhập Code và Tên phòng ban.");
      return;
    }
    setLoading(true);
    try {
      await createTenantDepartment({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo phòng ban thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-zinc-950/70" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-2xl">
        {/* Gradient header */}
        <div className="shrink-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-500" />
        
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <Plus className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Thêm phòng ban</h3>
              <p className="text-xs text-zinc-400">Tạo mới phòng ban trong tổ chức.</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Code *</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="HR"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tên *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Phòng Nhân Sự"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                placeholder="(tuỳ chọn)"
              />
            </div>

            <div className="mt-6 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-600 disabled:opacity-60"
              >
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {loading ? "Đang tạo…" : "Tạo"}
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

