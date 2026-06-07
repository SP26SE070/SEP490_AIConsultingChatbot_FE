"use client";

import { useState, useEffect } from "react";
import { Loader2, Database, Download, Check } from "lucide-react";
import { ErrorNotice } from "@/components/ui";
import { useLanguageStore } from "@/lib/language-store";
import {
  getAdminTenants,
  listEnterpriseTenants,
  provisionEnterprise,
  backupEnterpriseTenant,
  type AdminTenantSummary,
} from "@/lib/api/admin";

const enterpriseBackupEnabled = process.env.NEXT_PUBLIC_ENABLE_ENTERPRISE_BACKUP === "true";

export function OrganizationsTable() {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const [organizations, setOrganizations] = useState<AdminTenantSummary[]>([]);
  const [enterpriseIds, setEnterpriseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ tenantId: string; action: "provision" | "backup" } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tenants, enterprises] = await Promise.all([
        getAdminTenants(),
        listEnterpriseTenants().catch(() => []),
      ]);
      setOrganizations(tenants);
      setEnterpriseIds(new Set(enterprises.map((e) => e.tenantId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organizations");
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshEnterpriseIds = async () => {
    const enterprises = await listEnterpriseTenants().catch(() => []);
    setEnterpriseIds(new Set(enterprises.map((e) => e.tenantId)));
  };

  const handleProvision = async (tenantId: string, name: string) => {
    setActionState({ tenantId, action: "provision" });
    setFeedback(null);
    try {
      const result = await provisionEnterprise(tenantId);
      setFeedback({
        type: "success",
        text: isEn
          ? `Provisioned "${name}" as Enterprise (DB: ${result.databaseName})`
          : `Đã cấp phát "${name}" thành Enterprise (DB: ${result.databaseName})`,
      });
      await refreshEnterpriseIds();
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Provisioning failed" });
    } finally {
      setActionState(null);
    }
  };

  const handleBackup = async (tenantId: string, name: string) => {
    if (!enterpriseBackupEnabled) {
      setFeedback({
        type: "error",
        text: isEn
          ? "SQL export is available only in the admin/VPS backup environment."
          : "SQL export chỉ khả dụng trong môi trường admin/VPS backup.",
      });
      return;
    }

    setActionState({ tenantId, action: "backup" });
    setFeedback(null);
    try {
      const { blob, filename } = await backupEnterpriseTenant(tenantId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setFeedback({
        type: "success",
        text: isEn ? `Backup downloaded for "${name}"` : `Đã tải bản sao lưu cho "${name}"`,
      });
    } catch (e) {
      setFeedback({ type: "error", text: e instanceof Error ? e.message : "Backup failed" });
    } finally {
      setActionState(null);
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { vi: string; en: string }> = {
      ACTIVE: { vi: "Hoạt động", en: "Active" },
      PENDING: { vi: "Chờ duyệt", en: "Pending" },
      SUSPENDED: { vi: "Tạm ngưng", en: "Suspended" },
      REJECTED: { vi: "Từ chối", en: "Rejected" },
    };
    return statusMap[status]?.[language] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "PENDING":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "SUSPENDED":
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400";
      case "REJECTED":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-8 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        <span className="text-sm text-zinc-500">{isEn ? "Loading..." : "Đang tải..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center dark:bg-zinc-950">
        <ErrorNotice message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-green-100/60 dark:bg-zinc-950 dark:shadow-black/40">
        <div className="table-scroll-container">
          <table className="min-w-xl table-auto divide-y divide-zinc-100 dark:divide-zinc-900 lg:min-w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {isEn ? "Organization" : "Tổ chức"}
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  ID
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {isEn ? "Status" : "Trạng thái"}
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  {isEn ? "Enterprise Actions" : "Thao tác Enterprise"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-zinc-500">
                    {isEn ? "No organizations found." : "Không có tổ chức nào."}
                  </td>
                </tr>
              ) : null}
              {organizations.map((org) => {
                const isEnterprise = enterpriseIds.has(org.id);
                const isProvisioning = actionState?.tenantId === org.id && actionState.action === "provision";
                const isBackingUp = actionState?.tenantId === org.id && actionState.action === "backup";
                const anyActionOnRow = isProvisioning || isBackingUp;
                return (
                  <tr key={org.id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-4 align-top sm:px-6">
                      <div className="max-w-64 whitespace-normal wrap-break-word text-sm font-medium text-zinc-900 dark:text-white">
                        {org.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top sm:px-6">
                      <div className="max-w-64 break-all text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {org.id}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top sm:px-6">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${getStatusColor(org.status ?? "")}`}>
                        {getStatusLabel(org.status ?? "UNKNOWN")}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top sm:px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {isEnterprise ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                            <Check className="h-3 w-3" />
                            Enterprise
                          </span>
                        ) : (
                          <button
                            onClick={() => handleProvision(org.id, org.name)}
                            disabled={anyActionOnRow}
                            className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProvisioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                            {isEn ? "Provision Enterprise" : "Cấp phát Enterprise"}
                          </button>
                        )}
                        {isEnterprise && enterpriseBackupEnabled ? (
                          <button
                            onClick={() => handleBackup(org.id, org.name)}
                            disabled={anyActionOnRow}
                            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            {isBackingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            {isEn ? "Backup" : "Sao lưu"}
                          </button>
                        ) : isEnterprise ? (
                          <span
                            className="inline-flex max-w-64 items-center rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold leading-snug text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-200"
                            title={
                              isEn
                                ? "SQL export is available only in the admin/VPS backup environment."
                                : "SQL export chỉ khả dụng trong môi trường admin/VPS backup."
                            }
                          >
                            {isEn
                              ? "SQL export: admin/VPS backup only"
                              : "SQL export: chỉ admin/VPS backup"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
