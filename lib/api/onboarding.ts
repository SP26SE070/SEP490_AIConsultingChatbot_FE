import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { parseApiErrorMessage } from "@/lib/api/parseApiError";
import { ONBOARDING_BASE, STAFF_ONBOARDING_BASE } from "@/lib/api/config";
import type {
  CreateOnboardingModuleRequest,
  OnboardingModuleResponse,
  OnboardingMyOverviewResponse,
  OnboardingProgressResponse,
  UpdateOnboardingModuleRequest,
} from "@/types/onboarding";
import type { PermissionCategoryDto } from "@/lib/permissions";

export type OnboardingAttachmentContent =
  | { kind: "text"; text: string; mime: string }
  | { kind: "pdf"; url: string; mime: string }
  | { kind: "binary"; mime: string };

async function parseResponseOrThrow<T>(res: Response, fallbackMessage: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const parsed = body ? parseApiErrorMessage(body) : "";
    throw new Error(parsed || fallbackMessage);
  }
  return (await res.json()) as T;
}

function normalizeMime(contentType: string | null): string {
  return (contentType ?? "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function parseFilenameFromContentDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // Fallback below.
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();

  return null;
}

export async function getMyOnboarding(): Promise<OnboardingMyOverviewResponse> {
  const res = await fetchWithAuth(`${ONBOARDING_BASE}/me`);
  return parseResponseOrThrow<OnboardingMyOverviewResponse>(res, "Khong tai duoc onboarding");
}

export async function updateMyOnboardingProgress(
  moduleId: string,
  readPercent: number
): Promise<OnboardingProgressResponse> {
  const res = await fetchWithAuth(`${ONBOARDING_BASE}/modules/${moduleId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readPercent }),
  });
  return parseResponseOrThrow<OnboardingProgressResponse>(res, "Khong cap nhat duoc tien do onboarding");
}

export async function markMyOnboardingModuleCompleted(
  moduleId: string
): Promise<OnboardingProgressResponse> {
  const res = await fetchWithAuth(`${ONBOARDING_BASE}/modules/${moduleId}/complete`, {
    method: "POST",
  });
  return parseResponseOrThrow<OnboardingProgressResponse>(res, "Khong danh dau hoan thanh duoc onboarding");
}

export async function getMyOnboardingModuleAttachment(
  moduleId: string
): Promise<OnboardingAttachmentContent> {
  const res = await fetchWithAuth(`${ONBOARDING_BASE}/modules/${moduleId}/attachment`, {
    headers: {
      Accept: "application/pdf, text/plain, */*;q=0.8",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const parsed = body ? parseApiErrorMessage(body) : "";
    throw new Error(parsed || "Khong tai duoc file chi tiet onboarding");
  }

  const mime = normalizeMime(res.headers.get("content-type"));
  const disposition = res.headers.get("content-disposition");
  const filename = parseFilenameFromContentDisposition(disposition)?.toLowerCase() ?? "";
  const blob = await res.blob();

  const isPdf = mime === "application/pdf" || filename.endsWith(".pdf");
  if (isPdf) {
    return {
      kind: "pdf",
      url: URL.createObjectURL(blob),
      mime: "application/pdf",
    };
  }

  const isText = mime.startsWith("text/") || filename.endsWith(".txt");
  if (isText) {
    return {
      kind: "text",
      text: await blob.text(),
      mime: mime || "text/plain",
    };
  }

  return {
    kind: "binary",
    mime,
  };
}

export async function getStaffOnboardingAvailablePermissions(): Promise<PermissionCategoryDto[]> {
  const res = await fetchWithAuth(`${STAFF_ONBOARDING_BASE}/permissions/available`);
  return parseResponseOrThrow<PermissionCategoryDto[]>(
    res,
    "Khong tai duoc danh sach quyen onboarding"
  );
}

export async function getStaffOnboardingModules(
  includeInactive: boolean = false
): Promise<OnboardingModuleResponse[]> {
  const params = new URLSearchParams({ includeInactive: String(includeInactive) });
  const res = await fetchWithAuth(`${STAFF_ONBOARDING_BASE}/modules?${params.toString()}`);
  return parseResponseOrThrow<OnboardingModuleResponse[]>(res, "Khong tai duoc danh sach onboarding modules");
}

export async function createStaffOnboardingModule(
  payload: CreateOnboardingModuleRequest
): Promise<OnboardingModuleResponse> {
  const res = await fetchWithAuth(`${STAFF_ONBOARDING_BASE}/modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponseOrThrow<OnboardingModuleResponse>(res, "Khong tao duoc onboarding module");
}

export async function updateStaffOnboardingModule(
  moduleId: string,
  payload: UpdateOnboardingModuleRequest
): Promise<OnboardingModuleResponse> {
  const res = await fetchWithAuth(`${STAFF_ONBOARDING_BASE}/modules/${moduleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponseOrThrow<OnboardingModuleResponse>(res, "Khong cap nhat duoc onboarding module");
}

export async function uploadStaffOnboardingModuleAttachment(
  moduleId: string,
  file: File
): Promise<OnboardingModuleResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetchWithAuth(`${STAFF_ONBOARDING_BASE}/modules/${moduleId}/attachment`, {
    method: "POST",
    body: form,
  });

  return parseResponseOrThrow<OnboardingModuleResponse>(
    res,
    "Khong upload duoc file chi tiet onboarding"
  );
}

export async function deactivateStaffOnboardingModule(
  moduleId: string
): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${STAFF_ONBOARDING_BASE}/modules/${moduleId}`, {
    method: "DELETE",
  });
  return parseResponseOrThrow<{ message: string }>(res, "Khong vo hieu hoa duoc onboarding module");
}
