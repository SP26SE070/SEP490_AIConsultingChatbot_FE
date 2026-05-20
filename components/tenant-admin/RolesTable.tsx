"use client";

import { useState, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { ErrorNotice } from "@/components/ui";
import { getTenantRoles, type RoleResponse } from "@/lib/api/tenant-admin";

export function RolesTable() {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTenantRoles()
      .then(setRoles)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải danh sách"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white p-8 shadow-lg dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Đang tải danh sách vai trò…</p>
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
    <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-green-100/60 dark:bg-zinc-950 dark:shadow-black/40">
      <div className="table-scroll-container">
        <table className="min-w-160 table-auto divide-y divide-zinc-100 dark:divide-zinc-900 lg:min-w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Role</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Code</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Users</th>
              <th className="relative px-6 py-4"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
            {roles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-zinc-500">
                  Chưa có vai trò. Dữ liệu được tải từ máy chủ.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-4 align-top text-sm font-medium text-zinc-900 dark:text-white sm:px-6">
                    <div className="max-w-56 whitespace-normal wrap-break-word">{role.name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-600 dark:text-zinc-400 sm:px-6">
                    <div className="max-w-48 whitespace-normal wrap-break-word">{role.code ?? "—"}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-zinc-900 dark:text-white sm:px-6">{role.usersCount ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right align-top sm:px-6">
                    <button className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-500 dark:hover:bg-zinc-900">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
