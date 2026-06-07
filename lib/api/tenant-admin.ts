import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { TENANT_ADMIN_BASE } from "@/lib/api/config";
import {
  flattenPermissionCategories,
  type PermissionCategoryDto,
  type PermissionOption,
} from "@/lib/permissions";

async function handleTenantAdminResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (typeof data.message === "string") throw new Error(data.message);
    if (typeof data.error === "string") throw new Error(data.error);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const first = Object.values(data).find((v) => typeof v === "string");
      if (first) throw new Error(String(first));
    }
    throw new Error("Request failed");
  }
  return data as T;
}

export interface TenantDashboardResponse {
  totalUsers?: number;
  documents?: {
    totalDocuments?: number;
    totalChunks?: number;
    averageChunksPerDocument?: number;
  };
  llmUsage?: {
    totalTokensUsed?: number;
    totalRequests?: number;
    requestsThisMonth?: number;
    tokensThisMonth?: number;
    averageTokensPerRequest?: number;
  };
}

/** GET /api/v1/tenant-admin/dashboard/llm-usage */
export interface TenantLlmUsageResponse {
  totalTokensUsed?: number;
  totalRequests?: number;
  tokensThisMonth?: number;
  requestsThisMonth?: number;
  tokensToday?: number;
  requestsToday?: number;
  averageTokensPerRequest?: number;
}

/** GET /api/v1/tenant-admin/dashboard/documents */
export interface TenantDocumentDashboardStatsResponse {
  totalDocuments?: number;
  totalChunks?: number;
  averageChunksPerDocument?: number;
  embeddingStatusBreakdown?: Record<string, number>;
}

export interface TenantAnalyticsResponse {
  totalUsers?: number;
  activeUsers?: number;
  newUsersThisMonth?: number;
  usersByRole?: Record<string, number>;
  usersByDepartment?: Record<string, number>;
  usersCreatedLast7Days?: number;
  usersCreatedLast30Days?: number;
  totalDocuments?: number;
  storageUsedGb?: number;
}

export interface UserResponse {
  id: string;
  email?: string;
  contactEmail?: string;
  fullName?: string;
  emailSent?: boolean;
  departmentId?: number;
  departmentName?: string;
  /** Trùng `roles.id` / `role_id` trong DB (một user — một role). */
  roleId?: number;
  /** Ví dụ EMPLOYEE, TENANT_ADMIN */
  roleCode?: string;
  roleName?: string;
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  /** Additional user-specific permissions. */
  permissions?: string[];
}

export interface DepartmentResponse {
  id: number;
  name?: string;
  code?: string;
  description?: string;
  parentId?: number;
  isActive?: boolean;
  employeeCount?: number;
}

export interface RoleResponse {
  id: number;
  name?: string;
  code?: string;
  level?: number;
  description?: string;
  usersCount?: number;
  /** Optional permissions list (if BE returns in role detail). */
  permissions?: string[];
}

export interface TenantLogoUploadResponse {
  logoUrl?: string;
}

export interface TenantInfoResponse {
  tenantId?: string;
  name?: string;
  address?: string;
  website?: string;
  companySize?: string;
  logoUrl?: string;
  contactEmail?: string;
  representativeName?: string;
  representativePosition?: string;
  representativePhone?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateTenantProfileRequest {
  address?: string | null;
  website?: string | null;
  companySize?: string | null;
}

function normalizeTenantInfo(raw: unknown): TenantInfoResponse {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    tenantId:
      typeof o.tenant_id === "string"
        ? o.tenant_id
        : typeof o.tenantId === "string"
          ? o.tenantId
          : undefined,
    name: typeof o.name === "string" ? o.name : undefined,
    address: typeof o.address === "string" ? o.address : undefined,
    website: typeof o.website === "string" ? o.website : undefined,
    companySize:
      typeof o.company_size === "string"
        ? o.company_size
        : typeof o.companySize === "string"
          ? o.companySize
          : undefined,
    logoUrl:
      typeof o.logo_url === "string"
        ? o.logo_url
        : typeof o.logoUrl === "string"
          ? o.logoUrl
          : undefined,
    contactEmail:
      typeof o.contact_email === "string"
        ? o.contact_email
        : typeof o.contactEmail === "string"
          ? o.contactEmail
          : undefined,
    representativeName:
      typeof o.representative_name === "string"
        ? o.representative_name
        : typeof o.representativeName === "string"
          ? o.representativeName
          : undefined,
    representativePosition:
      typeof o.representative_position === "string"
        ? o.representative_position
        : typeof o.representativePosition === "string"
          ? o.representativePosition
          : undefined,
    representativePhone:
      typeof o.representative_phone === "string"
        ? o.representative_phone
        : typeof o.representativePhone === "string"
          ? o.representativePhone
          : undefined,
    status: typeof o.status === "string" ? o.status : undefined,
    createdAt:
      typeof o.created_at === "string"
        ? o.created_at
        : typeof o.createdAt === "string"
          ? o.createdAt
          : undefined,
    updatedAt:
      typeof o.updated_at === "string"
        ? o.updated_at
        : typeof o.updatedAt === "string"
          ? o.updatedAt
          : undefined,
  };
}

/** POST /api/v1/tenant-admin/tenant/logo */
export async function uploadTenantLogo(file: File): Promise<TenantLogoUploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/tenant/logo`, {
    method: "POST",
    body: form,
  });

  return handleTenantAdminResponse<TenantLogoUploadResponse>(res);
}

/** GET /api/v1/tenant-admin/dashboard/tenant */
export async function getTenantInfo(): Promise<TenantInfoResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/dashboard/tenant`);
  if (!res.ok) {
    throw new Error(await res.text().catch(() => "Failed to load tenant info"));
  }
  const data = await res.json().catch(() => ({}));
  return normalizeTenantInfo(data);
}

/** PUT /api/v1/tenant-admin/tenant/profile */
export async function updateTenantProfile(
  body: UpdateTenantProfileRequest
): Promise<TenantInfoResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/tenant/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await handleTenantAdminResponse<TenantInfoResponse>(res);
  return normalizeTenantInfo(data);
}

/** Parse `permissions` from GET role / list (string[] or legacy { code }[]). */
function parsePermissionsField(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item);
    else if (item && typeof item === "object" && "code" in item) {
      const c = (item as { code?: unknown }).code;
      if (typeof c === "string" && c.length > 0) out.push(c);
    }
  }
  return out;
}

function firstNonNegativeInt(...values: unknown[]): number {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  }
  return 0;
}

/** Map BE variants (department_id, departmentId, ...) into DepartmentResponse.id */
function normalizeTenantDepartment(raw: unknown): DepartmentResponse {
  if (!raw || typeof raw !== "object") {
    return { id: 0 };
  }
  const o = raw as Record<string, unknown>;
  const idRaw = o.id ?? o.department_id ?? o.departmentId;
  const id = Number(idRaw);
  return {
    id: Number.isFinite(id) ? id : 0,
    name: typeof o.name === "string" ? o.name : undefined,
    code: typeof o.code === "string" ? o.code : undefined,
    description: typeof o.description === "string" ? o.description : undefined,
    parentId:
      typeof o.parentId === "number"
        ? o.parentId
        : typeof o.parent_id === "number"
          ? o.parent_id
          : undefined,
    isActive:
      typeof o.isActive === "boolean"
        ? o.isActive
        : typeof o.is_active === "boolean"
          ? o.is_active
          : undefined,
    employeeCount: firstNonNegativeInt(
      o.employeeCount,
      o.employee_count,
      o.userCount,
      o.usersCount
    ),
  };
}

function normalizeDepartmentList(data: unknown): DepartmentResponse[] {
  if (Array.isArray(data)) {
    return data
      .map((item) => normalizeTenantDepartment(item))
      .filter((department) => department.id > 0);
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const inner = o.content ?? o.data ?? o.departments ?? o.items;
    if (Array.isArray(inner)) return normalizeDepartmentList(inner);
    if (inner && typeof inner === "object") return normalizeDepartmentList(inner);
  }
  return [];
}

/** Map BE variants (userCount, users_count, …) into RoleResponse.usersCount */
export function normalizeTenantRole(raw: unknown): RoleResponse {
  if (!raw || typeof raw !== "object") {
    return { id: 0 };
  }
  const o = raw as Record<string, unknown>;
  const idRaw = o.id ?? o.role_id ?? o.roleId;
  const id = Number(idRaw);
  const level = Number(o.level);
  const permissions = parsePermissionsField(o.permissions);

  return {
    id: Number.isFinite(id) ? id : 0,
    name: typeof o.name === "string" ? o.name : undefined,
    code: typeof o.code === "string" ? o.code : undefined,
    level: Number.isFinite(level) ? level : undefined,
    description: typeof o.description === "string" ? o.description : undefined,
    usersCount: firstNonNegativeInt(
      o.usersCount,
      o.userCount,
      o.users_count,
      o.user_count,
      o.assignedUserCount,
      o.assignedUsersCount,
      o.memberCount,
      o.membersCount,
      o.numberOfUsers,
    ),
    ...(permissions !== undefined ? { permissions } : {}),
  };
}

function normalizeRoleList(list: unknown): RoleResponse[] {
  if (!Array.isArray(list)) {
    if (list && typeof list === "object") {
      const o = list as Record<string, unknown>;
      const inner = o.content ?? o.data ?? o.roles;
      if (Array.isArray(inner)) return normalizeRoleList(inner);
      if (inner && typeof inner === "object") return normalizeRoleList(inner);
    }
    return [];
  }
  return list.map((item) => normalizeTenantRole(item)).filter((r) => r.id > 0);
}

export async function getTenantDashboard(): Promise<TenantDashboardResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/dashboard`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load dashboard"));
  return res.json();
}

export async function getTenantLlmUsage(): Promise<TenantLlmUsageResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/dashboard/llm-usage`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load LLM usage"));
  return res.json();
}

export async function getTenantDocumentDashboardStats(): Promise<TenantDocumentDashboardStatsResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/dashboard/documents`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load document statistics"));
  return res.json();
}

export async function getTenantAnalytics(): Promise<TenantAnalyticsResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/dashboard/analytics`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load analytics"));
  return res.json();
}

function normalizeUserList(data: unknown): UserResponse[] {
  if (Array.isArray(data)) return data as UserResponse[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const inner = o.content ?? o.data;
    if (Array.isArray(inner)) return inner as UserResponse[];
  }
  return [];
}

/** `status`: ACTIVE (default) | INACTIVE | ALL. `roleId`: lọc user theo role (optional). */
export async function getTenantUsers(
  status: string = "ACTIVE",
  options?: { roleId?: number }
): Promise<UserResponse[]> {
  const params = new URLSearchParams({ status });
  if (options?.roleId != null && Number.isFinite(options.roleId)) {
    params.set("roleId", String(options.roleId));
  }
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load users"));
  const data: unknown = await res.json();
  
  // Handle paginated response
  if (data && typeof data === "object" && "content" in data && Array.isArray(data.content)) {
    return data.content as UserResponse[];
  }
  
  // Handle direct array response
  if (Array.isArray(data)) {
    return data as UserResponse[];
  }
  
  return [];
}

export async function getTenantDepartments(): Promise<DepartmentResponse[]> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/departments`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load departments"));
  const data: unknown = await res.json();
  return normalizeDepartmentList(data);
}

export async function getTenantRoles(): Promise<RoleResponse[]> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load roles"));
  const data: unknown = await res.json();
  return normalizeRoleList(data);
}

// ---------- User management (align with API 11) ----------
export async function getTenantUserById(userId: string): Promise<UserResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/${userId}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load user"));
  return res.json();
}

export interface CreateUserRequest {
  fullName: string;
  contactEmail: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  roleId: number;
  departmentId?: number;
  permissions?: string[];
}

export interface UpdateUserRequest {
  fullName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  departmentId?: number;
  roleId?: number;
}

export async function createTenantUser(body: CreateUserRequest): Promise<UserResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to create user"));
  return res.json();
}

export async function updateTenantUser(userId: string, body: UpdateUserRequest): Promise<UserResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to update user"));
  return res.json();
}

export async function updateTenantUserPermissions(userId: string, permissions: string[]): Promise<UserResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/${userId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to update permissions"));
  return res.json();
}

export async function activateTenantUser(userId: string): Promise<UserResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/${userId}/activate`, { method: "PUT" });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to activate user"));
  return res.json();
}

export async function deactivateTenantUser(userId: string): Promise<UserResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/${userId}/deactivate`, { method: "PUT" });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to deactivate user"));
  return res.json();
}

export async function deleteTenantUser(userId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/${userId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to delete user");
  return data;
}

export async function resetTenantUserPassword(userId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/${userId}/reset-password`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to reset password");
  return data;
}

// ---------- Employee import (Excel) ----------
export interface EmployeeImportPreviewResponse {
  importSessionId: string;
  expiresAt: string;
  summary: { total: number; valid: number; invalid: number };
  validRows: Array<{
    rowNumber: number;
    stt?: string | null;
    fullName: string;
    contactEmail: string;
    phoneNumber?: string | null;
    dateOfBirth?: string | null;
    address?: string | null;
    roleCode: string;
    roleName?: string | null;
    departmentCode?: string | null;
    departmentName?: string | null;
  }>;
  invalidRows: Array<{
    rowNumber: number;
    stt?: string | null;
    fullName?: string | null;
    contactEmail?: string | null;
    errors: string[];
  }>;
}

export interface EmployeeImportConfirmResponse {
  createdCount: number;
  failedCount: number;
  emailsQueued: number;
  created: Array<{
    rowNumber: number;
    userId: string;
    fullName: string;
    loginEmail: string;
    contactEmail: string;
  }>;
  failed: Array<{
    rowNumber: number;
    contactEmail?: string | null;
    message: string;
  }>;
}

export async function downloadEmployeeImportTemplate(): Promise<void> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/import/template`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Không tải được file mẫu"));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import-nhan-vien-mau.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewEmployeeImport(file: File): Promise<EmployeeImportPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/import/preview`, {
    method: "POST",
    body: form,
  });
  return handleTenantAdminResponse<EmployeeImportPreviewResponse>(res);
}

export async function confirmEmployeeImport(importSessionId: string): Promise<EmployeeImportConfirmResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/users/import/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ importSessionId }),
  });
  return handleTenantAdminResponse<EmployeeImportConfirmResponse>(res);
}

// ---------- Department management (align with API 12) ----------
export async function getTenantDepartmentById(departmentId: number): Promise<DepartmentResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/departments/${departmentId}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load department"));
  return res.json();
}

export async function getTenantActiveDepartments(): Promise<DepartmentResponse[]> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/departments/active`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load active departments"));
  const data: unknown = await res.json();
  return normalizeDepartmentList(data);
}

export interface CreateDepartmentRequest {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  code?: string;
  name?: string;
  description?: string;
  parentId?: number;
  isActive?: boolean;
}

export async function createTenantDepartment(body: CreateDepartmentRequest): Promise<DepartmentResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/departments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to create department"));
  return res.json();
}

export async function updateTenantDepartment(departmentId: number, body: UpdateDepartmentRequest): Promise<DepartmentResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/departments/${departmentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to update department"));
  return res.json();
}

export async function deleteTenantDepartment(departmentId: number): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/departments/${departmentId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to delete department");
  return data;
}

// ---------- Role management (align with API 13) ----------
export async function getTenantRoleById(roleId: number): Promise<RoleResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles/${roleId}`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load role"));
  const data: unknown = await res.json();
  return normalizeTenantRole(data);
}

export async function getTenantCustomRoles(): Promise<RoleResponse[]> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles/custom`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load custom roles"));
  const data: unknown = await res.json();
  return normalizeRoleList(data);
}

export async function getTenantFixedRoles(): Promise<RoleResponse[]> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles/fixed`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load fixed roles"));
  const data: unknown = await res.json();
  return normalizeRoleList(data);
}

/** Backend returns { category, permissions: { code, name, description }[] }[] */
export async function getTenantAvailablePermissions(): Promise<PermissionOption[]> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles/permissions/available`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load permissions"));
  const categories: PermissionCategoryDto[] = await res.json();
  return flattenPermissionCategories(categories);
}

export async function getTenantPermissionCategories(): Promise<PermissionCategoryDto[]> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles/permissions/available`);
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load permissions"));
  return res.json();
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  level: number;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  level?: number;
  description?: string;
  permissions?: string[];
}

export async function createTenantRole(body: CreateRoleRequest): Promise<RoleResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to create role"));
  const data: unknown = await res.json();
  return normalizeTenantRole(data);
}

export async function updateTenantRole(roleId: number, body: UpdateRoleRequest): Promise<RoleResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles/${roleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Failed to update role"));
  const data: unknown = await res.json();
  return normalizeTenantRole(data);
}

export async function deleteTenantRole(roleId: number): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/roles/${roleId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to delete role");
  return data;
}
