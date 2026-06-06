import { PROFILE_BASE } from "./config";
import { fetchWithAuth } from "./fetchWithAuth";
import type {
  UserProfileResponse,
  UpdateProfileRequest,
  ChangePasswordRequest,
  UpdateContactEmailRequest,
  VerifyContactEmailRequest,
} from "@/types/profile";
import type { MessageResponse } from "@/types/auth";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function handleResponse<T>(res: Response): Promise<T> {
  // Get content type to determine how to parse response
  const contentType = res.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  
  let data: Record<string, unknown> = {};
  let rawText = "";
  
  if (isJson) {
    try {
      data = await res.json();
    } catch (e) {
      // JSON parse failed, try to read as text
      try {
        rawText = await res.text();
      } catch {
        rawText = "";
      }
    }
  } else {
    // Non-JSON response, read as text
    try {
      rawText = await res.text();
    } catch {
      rawText = "";
    }
  }

  if (!res.ok) {
    // Try to extract error message in priority order
    
    // 1. Check for 'message' field (most common)
    if (typeof data.message === "string" && data.message.trim()) {
      throw new Error(data.message.trim());
    }
    
    // 2. Check for 'error' field
    if (typeof data.error === "string" && data.error.trim()) {
      throw new Error(data.error.trim());
    }
    
    // 3. Check for 'errors' field (array or object)
    if (data.errors) {
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const firstError = data.errors[0];
        if (typeof firstError === "string") throw new Error(firstError);
        if (firstError && typeof firstError === "object" && "message" in firstError) {
          throw new Error(String(firstError.message));
        }
      } else if (typeof data.errors === "string") {
        throw new Error(data.errors);
      }
    }
    
    // 4. Look for any string value in response object
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const stringValues = Object.entries(data)
        .filter(([key, value]) => key !== "code" && key !== "status" && typeof value === "string" && String(value).trim())
        .map(([, value]) => String(value).trim());
      
      if (stringValues.length > 0) {
        throw new Error(stringValues[0]);
      }
    }
    
    // 5. Use raw text if available
    if (rawText && rawText.trim()) {
      throw new Error(rawText.trim());
    }
    
    // 6. Generic error with status code
    throw new Error(`Request failed with status ${res.status}`);
  }
  
  return data as T;
}

/** GET /api/v1/profile/me — uses token from store, retries with refresh on 401 */
export async function getProfile(): Promise<UserProfileResponse> {
  const res = await fetchWithAuth(`${PROFILE_BASE}/me`, { method: "GET" });
  return handleResponse<UserProfileResponse>(res);
}

/** PUT /api/v1/profile/update */
export async function updateProfile(
  body: UpdateProfileRequest
): Promise<UserProfileResponse> {
  const res = await fetchWithAuth(`${PROFILE_BASE}/update`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return handleResponse<UserProfileResponse>(res);
}

/** POST /api/v1/profile/change-password */
export async function changePassword(
  body: ChangePasswordRequest
): Promise<MessageResponse> {
  const res = await fetchWithAuth(`${PROFILE_BASE}/change-password`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return handleResponse<MessageResponse>(res);
}

/** POST /api/v1/profile/contact-email/request */
export async function requestUpdateContactEmail(
  body: UpdateContactEmailRequest
): Promise<MessageResponse> {
  const res = await fetchWithAuth(`${PROFILE_BASE}/contact-email/request`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return handleResponse<MessageResponse>(res);
}

/** POST /api/v1/profile/contact-email/verify */
export async function verifyAndUpdateContactEmail(
  body: VerifyContactEmailRequest
): Promise<MessageResponse> {
  const res = await fetchWithAuth(`${PROFILE_BASE}/contact-email/verify`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return handleResponse<MessageResponse>(res);
}

/** GET /api/v1/profile/permissions — returns current user's permissions */
export async function getCurrentUserPermissions(): Promise<string[]> {
  const res = await fetchWithAuth(`${PROFILE_BASE}/permissions`, {
    method: "GET",
  });
  const data = await handleResponse<{ permissions: string[] }>(res);
  return data.permissions ?? [];
}
