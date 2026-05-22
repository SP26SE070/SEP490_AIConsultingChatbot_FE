import { API_BASE_URL } from "./config";

export interface TenantInfoResponse {
  id: string;
  name: string;
  address?: string | null;
  website?: string | null;
  companySize?: string | null;
  logoUrl?: string | null;
  additionalLogoUrl?: string | null;
  additionalLogoType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTenantProfileRequest {
  address?: string;
  website?: string;
  companySize?: string;
}

/**
 * Get current tenant information
 */
export async function getTenantInfo(): Promise<TenantInfoResponse> {
  const token = localStorage.getItem("token");
  
  if (!token) {
    throw new Error("No authentication token found");
  }

  console.log("Fetching tenant info from:", `${API_BASE_URL}/api/v1/tenant-admin/dashboard/tenant`);
  
  const response = await fetch(`${API_BASE_URL}/api/v1/tenant-admin/dashboard/tenant`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  console.log("Response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error response:", errorText);
    throw new Error(errorText || `Failed to fetch tenant info (${response.status})`);
  }

  const data = await response.json();
  console.log("Tenant info received:", data);
  return data;
}

/**
 * Update tenant profile (address, website, companySize)
 */
export async function updateTenantProfile(data: UpdateTenantProfileRequest): Promise<TenantInfoResponse> {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}/api/v1/tenant-admin/tenant/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to update tenant profile");
  }

  return response.json();
}

/**
 * Upload tenant logo
 * Max 2MB, PNG/JPG only
 */
export async function uploadTenantLogo(file: File): Promise<{ 
  additionalLogoUrl: string;
  additionalLogoType: string;
}> {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/tenant-admin/tenant/logo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to upload logo");
  }

  return response.json();
}

/**
 * Delete tenant logo (if API exists)
 */
export async function deleteTenantLogo(): Promise<void> {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}/api/v1/tenant-admin/tenant/logo`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to delete logo");
  }
}
