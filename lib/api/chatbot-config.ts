import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { TENANT_ADMIN_BASE } from "@/lib/api/config";

export type ChatbotMode = "BALANCED" | "STRICT" | "FLEXIBLE";
export type EmbeddingProvider = "GEMINI" | "LOCAL";

export interface ChatbotConfigResponse {
  mode: ChatbotMode;
  embeddingProvider: EmbeddingProvider;
}

export async function getChatbotConfig(): Promise<ChatbotConfigResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/chatbot/config`);
  if (!res.ok) {
    throw new Error(await res.text().catch(() => "Failed to fetch chatbot config"));
  }
  return res.json();
}

export async function updateChatbotConfig(
  payload: { mode: ChatbotMode; embeddingProvider: EmbeddingProvider }
): Promise<ChatbotConfigResponse> {
  const res = await fetchWithAuth(`${TENANT_ADMIN_BASE}/chatbot/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await res.text().catch(() => "Failed to update chatbot config"));
  }
  return res.json();
}
