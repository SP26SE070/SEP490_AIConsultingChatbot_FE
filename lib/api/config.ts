const LOCAL_API_BASE_URL = "http://localhost:8080";
const PRODUCTION_API_BASE_URL =
  "https://sp26se070internalchatbotbe-production.up.railway.app";

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

function isLocalApiBaseUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  const baseUrl = envBaseUrl || (isProduction ? PRODUCTION_API_BASE_URL : LOCAL_API_BASE_URL);
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);

  if (isProduction && isLocalApiBaseUrl(normalizedBaseUrl)) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must not point to localhost in production."
    );
  }

  return normalizedBaseUrl;
}

export const API_BASE_URL = getApiBaseUrl();

export const AUTH_BASE = `${API_BASE_URL}/api/v1/auth`;
export const PROFILE_BASE = `${API_BASE_URL}/api/v1/profile`;
export const KNOWLEDGE_BASE = `${API_BASE_URL}/api/v1/knowledge`;
export const DOCUMENTS_BASE = `${KNOWLEDGE_BASE}/documents`;
export const CATEGORIES_BASE = `${KNOWLEDGE_BASE}/categories`;
export const TAGS_BASE = `${KNOWLEDGE_BASE}/tags`;
export const CHATBOT_BASE = `${API_BASE_URL}/api/v1/chatbot`;
export const ONBOARDING_BASE = `${API_BASE_URL}/api/v1/onboarding`;
export const TENANT_ADMIN_BASE = `${API_BASE_URL}/api/v1/tenant-admin`;
export const STAFF_BASE = `${API_BASE_URL}/api/v1/staff`;
export const STAFF_ONBOARDING_BASE = `${STAFF_BASE}/onboarding`;
export const TENANT_SUBSCRIPTION_BASE = `${API_BASE_URL}/api/v1/tenant-subscription`;
export const SUBSCRIPTIONS_BASE = `${API_BASE_URL}/api/v1/subscriptions`;
export const PAYMENT_BASE = `${API_BASE_URL}/api/v1/payment`;
export const ADMIN_BASE = `${API_BASE_URL}/api/v1/admin`;
