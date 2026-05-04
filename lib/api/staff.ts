import { fetchWithAuth } from "./fetchWithAuth";
import { STAFF_BASE } from "./config";

export type TenantStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

export type TransactionStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"
  | "SUCCESS"
  | "CANCELLED"
  | "CANCELED";

export interface Transaction {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  paymentMethod?: string;
  transactionType?: string;
}

export interface Tenant {
  id: string;
  name: string;
  address?: string;
  website?: string;
  companySize?: string;
  contactEmail: string;
  representativeName?: string;
  representativePosition?: string;
  representativePhone?: string;
  requestMessage?: string;
  requestedAt?: string;
  status: TenantStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  approvedByName?: string;
  rejectedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  subscriptionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StaffSubscriptionStatus =
  | "ACTIVE"
  | "TRIAL"
  | "EXPIRED"
  | "CANCELLED"
  | "CANCELED"
  | "PENDING";

export interface StaffSubscription {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantEmail?: string;
  tier?: string;
  planName?: string;
  status?: StaffSubscriptionStatus | string;
  subscriptionCode?: string;
  startedAt?: string;
  endedAt?: string;
  autoRenew?: boolean;
}

export interface StaffDashboardStats {
  tenants: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    /** When BE returns tenant analytics breakdown */
    rejected?: number;
    activePercentage?: number;
  };
  /**
   * Staff dashboard: same as `tenants.active` (active organizations), not platform user count.
   * Prefer parsing via `parsePlatformDashboardJson` in `lib/api/platform-dashboard.ts`.
   */
  totalUsers: number;
  subscriptions: { total: number };
  totalDocuments: number;
}

export async function getStaffDashboard(): Promise<StaffDashboardStats> {
  const res = await fetchWithAuth(`${STAFF_BASE}/analytics/dashboard`);
  if (!res.ok) throw new Error("Không tải được thống kê dashboard");
  return res.json();
}

export async function getTenants(): Promise<Tenant[]> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants`);
  if (!res.ok) throw new Error("Không tải được danh sách tenant");
  return res.json();
}

export async function getTenantById(tenantId: string): Promise<Tenant> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants/${tenantId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Không tìm thấy tenant");
    throw new Error("Không tải được chi tiết tenant");
  }
  return res.json();
}

export async function approveTenant(tenantId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants/${tenantId}/approve`, {
    method: "PUT",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Phê duyệt thất bại");
  return data;
}

export async function resendTenantCredentials(tenantId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants/${tenantId}/resend-credentials`, {
    method: "PUT",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Gửi lại email đăng nhập thất bại");
  return data;
}

export async function suspendTenant(tenantId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants/${tenantId}/suspend`, {
    method: "PUT",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Tạm ngưng thất bại");
  return data;
}

export async function activateTenant(tenantId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants/${tenantId}/activate`, {
    method: "PUT",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Kích hoạt thất bại");
  return data;
}

export async function rejectTenant(tenantId: string, reason: string): Promise<{ message: string }> {
  console.log("API Call - rejectTenant:", { tenantId, reason });
  
  // Try with query parameter first
  const urlWithQuery = `${STAFF_BASE}/tenants/${tenantId}/reject?reason=${encodeURIComponent(reason)}`;
  console.log("Request URL (with query):", urlWithQuery);
  
  let res = await fetchWithAuth(urlWithQuery, {
    method: "PUT",
  });
  
  console.log("Response status (PUT with query):", res.status);
  
  // If 500 error, try with body instead
  if (res.status === 500) {
    console.log("Retrying with body instead of query parameter...");
    const urlWithoutQuery = `${STAFF_BASE}/tenants/${tenantId}/reject`;
    console.log("Request URL (with body):", urlWithoutQuery);
    
    res = await fetchWithAuth(urlWithoutQuery, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });
    
    console.log("Response status (PUT with body):", res.status);
  }
  
  const data = await res.json().catch((err) => {
    console.error("Failed to parse JSON:", err);
    return {};
  });
  
  console.log("Response data:", data);
  
  if (!res.ok) {
    const errorMsg = data?.message || "Từ chối thất bại";
    console.error("API Error:", errorMsg);
    throw new Error(errorMsg);
  }
  
  return data;
}

export async function deleteTenant(tenantId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants/${tenantId}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Xóa thất bại");
  return data;
}

export async function hardDeleteTenant(tenantId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${STAFF_BASE}/tenants/${tenantId}/hard-delete`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Xóa cứng thất bại");
  return data;
}

// Transaction APIs
export async function getTransactions(): Promise<Transaction[]> {
  const res = await fetchWithAuth(`${STAFF_BASE}/transactions`);
  if (!res.ok) throw new Error("Không tải được danh sách giao dịch");
  return res.json();
}

export async function getTransactionById(transactionId: string): Promise<Transaction> {
  const res = await fetchWithAuth(`${STAFF_BASE}/transactions/${transactionId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Không tìm thấy giao dịch");
    throw new Error("Không tải được chi tiết giao dịch");
  }
  return res.json();
}

export async function getTransactionsByTenant(tenantId: string): Promise<Transaction[]> {
  const res = await fetchWithAuth(`${STAFF_BASE}/transactions/tenants/${tenantId}`);
  if (!res.ok) throw new Error("Không tải được giao dịch của tenant");
  return res.json();
}

export async function getStaffSubscriptions(): Promise<StaffSubscription[]> {
  const res = await fetchWithAuth(`${STAFF_BASE}/subscriptions`);
  if (!res.ok) throw new Error("Không tải được danh sách subscription");
  const raw = await res.json();
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : [];
  return rows.map((item: any, idx: number) => ({
    id: String(item?.id ?? item?.subscriptionId ?? idx),
    tenantId: String(item?.tenantId ?? item?.tenant?.id ?? ""),
    tenantName: String(item?.tenantName ?? item?.tenant?.name ?? "—"),
    tenantEmail:
      typeof item?.tenantEmail === "string"
        ? item.tenantEmail
        : typeof item?.tenant?.contactEmail === "string"
          ? item.tenant.contactEmail
          : undefined,
    tier:
      typeof item?.tier === "string"
        ? item.tier
        : typeof item?.subscriptionTier === "string"
          ? item.subscriptionTier
          : undefined,
    planName:
      typeof item?.planName === "string"
        ? item.planName
        : typeof item?.plan?.name === "string"
          ? item.plan.name
          : undefined,
    status: typeof item?.status === "string" ? item.status : undefined,
    subscriptionCode:
      typeof item?.subscriptionCode === "string"
        ? item.subscriptionCode
        : typeof item?.code === "string"
          ? item.code
          : typeof item?.subscriptionId === "string"
            ? item.subscriptionId
            : undefined,
    startedAt: typeof item?.startedAt === "string" ? item.startedAt : undefined,
    endedAt: typeof item?.endedAt === "string" ? item.endedAt : undefined,
    autoRenew: typeof item?.autoRenew === "boolean" ? item.autoRenew : undefined,
  }));
}
