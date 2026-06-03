import { fetchWithAuth } from "./fetchWithAuth";
import { ADMIN_BASE } from "./config";

// ---------- Staff (API 03) ----------
export interface StaffUser {
  id: string;
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  roleId?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateStaffRequest {
  contactEmail: string;
  fullName: string;
  phone?: string;
}

export async function getStaffList(): Promise<StaffUser[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/staff`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load staff"));
  return res.json();
}

export async function getStaffById(userId: string): Promise<StaffUser> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/staff/${userId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Staff not found");
    throw new Error(await res.text().catch(() => "Failed to load staff"));
  }
  return res.json();
}

export interface CreateStaffResponse {
  message: string;
  emailSent?: boolean;
}

export async function createStaff(body: CreateStaffRequest): Promise<CreateStaffResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  // Try to parse JSON response
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // If JSON parse fails, try to get text
    const text = await res.text().catch(() => "");
    if (text) data = { message: text };
  }
  
  if (!res.ok) {
    // Priority 1: Extract message from response
    if (typeof data.message === "string" && data.message.trim()) {
      throw new Error(data.message.trim());
    }
    // Priority 2: Extract error field
    if (typeof data.error === "string" && data.error.trim()) {
      throw new Error(data.error.trim());
    }
    // Priority 3: Look for any string value (but skip "code" and "status")
    if (data && typeof data === "object") {
      const stringValues = Object.entries(data)
        .filter(([key, value]) => 
          key !== "code" && 
          key !== "status" && 
          typeof value === "string" && 
          String(value).trim()
        )
        .map(([, value]) => String(value).trim());
      
      if (stringValues.length > 0) {
        throw new Error(stringValues[0]);
      }
    }
    // Priority 4: Generic error
    throw new Error("Failed to create staff");
  }
  
  return data;
}

export async function activateStaff(userId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/staff/${userId}/activate`, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to activate");
  return data;
}

export async function deactivateStaff(userId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/staff/${userId}/deactivate`, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to deactivate");
  return data;
}

export async function deleteStaff(userId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/staff/${userId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to delete");
  return data;
}

// ---------- Role Management (API 06) ----------
export interface AdminRoleResponse {
  id: number;
  code?: string;
  name?: string;
  description?: string;
  usersCount?: number;
  /** Optional permissions list (used by Super Admin Roles detail modal). */
  permissions?: string[];
  isSystemRole?: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAdminRoleRequest {
  code: string;
  name: string;
  description?: string;
  tenantId?: string | null;
}

export interface UpdateAdminRoleRequest {
  name?: string;
  description?: string;
}

export async function getAdminRoles(): Promise<AdminRoleResponse[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/roles`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load roles"));
  return res.json();
}

export async function getAdminRoleById(roleId: number): Promise<AdminRoleResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/roles/${roleId}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load role"));
  return res.json();
}

export async function createAdminRole(body: CreateAdminRoleRequest): Promise<AdminRoleResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to create role"));
  return res.json();
}

export async function updateAdminRole(roleId: number, body: UpdateAdminRoleRequest): Promise<AdminRoleResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/roles/${roleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to update role"));
  return res.json();
}

export async function deleteAdminRole(roleId: number): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/roles/${roleId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to delete role");
  return data;
}

// ---------- Subscription Plans (API 04) ----------
export interface SubscriptionPlanResponse {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  monthlyPrice?: number;
  quarterlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  maxUsers?: number;
  maxDocuments?: number;
  maxStorageGb?: number;
  maxApiCalls?: number;
  maxChatbotRequests?: number;
  maxRagDocuments?: number;
  maxAiTokens?: number;
  contextWindowTokens?: number;
  ragChunkSize?: number;
  aiModel?: string;
  embeddingModel?: string;
  enableRag?: boolean;
  isTrial?: boolean;
  trialDays?: number;
  isActive?: boolean;
  displayOrder?: number;
  features?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSubscriptionPlanRequest {
  planType: "TRIAL" | "STARTER" | "STANDARD" | "ENTERPRISE";
  name: string;
  description: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  maxUsers: number;
  maxDocuments: number;
  maxStorageGb: number;
  maxApiCalls: number;
  maxChatbotRequests: number;
  maxRagDocuments: number;
  maxAiTokens: number;
  contextWindowTokens: number;
  ragChunkSize: number;
  aiModel: string;
  embeddingModel: string;
  displayOrder: number;
  features: string;
}

export interface SubscriptionPlanTypeOption {
  code: "TRIAL" | "STARTER" | "STANDARD" | "ENTERPRISE";
  defaultName: string;
}

export interface UpdateSubscriptionPlanRequest {
  name: string;
  description?: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  maxUsers: number;
  maxDocuments: number;
  maxStorageGb: number;
  maxApiCalls: number;
  maxChatbotRequests: number;
  maxRagDocuments: number;
  maxAiTokens: number;
  contextWindowTokens: number;
  ragChunkSize: number;
  aiModel?: string;
  embeddingModel?: string;
  isActive: boolean;
  displayOrder: number;
  features?: string;
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlanResponse[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load plans"));
  return res.json();
}

export async function getActiveSubscriptionPlans(): Promise<SubscriptionPlanResponse[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans/active`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load active plans"));
  return res.json();
}

export async function getSubscriptionPlanById(id: string): Promise<SubscriptionPlanResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans/${id}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load plan"));
  return res.json();
}

export async function getSubscriptionPlanTypes(): Promise<SubscriptionPlanTypeOption[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans/types`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load plan types"));
  return res.json();
}

export async function createSubscriptionPlan(body: CreateSubscriptionPlanRequest): Promise<SubscriptionPlanResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Failed to create plan");
    console.error("❌ Backend error response:", errorText);
    throw new Error(errorText);
  }
  return res.json();
}

export async function updateSubscriptionPlan(id: string, body: UpdateSubscriptionPlanRequest): Promise<SubscriptionPlanResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to update plan"));
  return res.json();
}

export async function deleteSubscriptionPlan(id: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to delete plan");
  return data;
}

export async function activateSubscriptionPlan(id: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans/${id}/activate`, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to activate plan");
  return data;
}

export async function deactivateSubscriptionPlan(id: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscription-plans/${id}/deactivate`, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to deactivate plan");
  return data;
}

// ---------- Admin Tenants (SUPER_ADMIN – dropdown / lọc) ----------
export interface AdminTenantSummary {
  id: string;
  name: string;
  status?: string;
}

export async function getAdminTenants(): Promise<AdminTenantSummary[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/tenants`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load tenants"));
  return res.json();
}

// ---------- Admin Subscriptions - tenant đã mua (API 05) ----------
export interface AdminSubscriptionResponse {
  id: string;
  tenantId: string;
  tenantName?: string;
  tier?: string;
  status?: string;
  price?: number;
  currency?: string;
  billingCycle?: string;
  startDate?: string;
  endDate?: string;
  nextBillingDate?: string;
  isTrial?: boolean;
  trialEndDate?: string;
  autoRenew?: boolean;
  maxUsers?: number;
  maxDocuments?: number;
  maxStorageGb?: number;
  maxApiCalls?: number;
  maxChatbotRequests?: number;
  maxRagDocuments?: number;
  maxAiTokens?: number;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export async function getAdminSubscriptions(): Promise<AdminSubscriptionResponse[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscriptions`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load subscriptions"));
  return res.json();
}

export async function getActiveAdminSubscriptions(): Promise<AdminSubscriptionResponse[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscriptions/active`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load active subscriptions"));
  return res.json();
}

export async function getAdminSubscriptionsByTenant(tenantId: string): Promise<AdminSubscriptionResponse[]> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscriptions/tenant/${tenantId}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load tenant subscriptions"));
  return res.json();
}

export async function getAdminSubscriptionById(id: string): Promise<AdminSubscriptionResponse> {
  const res = await fetchWithAuth(`${ADMIN_BASE}/subscriptions/${id}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load subscription"));
  return res.json();
}
