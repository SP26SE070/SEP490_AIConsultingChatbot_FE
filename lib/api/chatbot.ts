import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { CHATBOT_BASE } from "@/lib/api/config";
import { isRatingMessageId } from "@/lib/chatMessageId";
import type { ChatRequest, ChatResponse, ConversationSummary, ChatHistoryResponse } from "@/types/chatbot";

export class ChatApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
    this.data = data;
  }
}

function parseBody(rawBody: string): unknown {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body) return null;
  if (typeof body === "string") {
    const message = body.trim();
    return message.length > 0 ? message : null;
  }
  if (typeof body !== "object") return null;

  const record = body as Record<string, unknown>;
  const candidates = [record.message, record.error, record.answer, record.detail];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    message: request.message,
    conversationId: request.conversationId ?? undefined,
    topK: request.topK ?? 7,
    categoryId: request.categoryId ?? undefined,
    tagIds: request.tagIds ?? undefined,
    targetDocumentId: request.targetDocumentId ?? undefined,
  };
  const res = await fetchWithAuth(`${CHATBOT_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawBody = await res.text().catch(() => "");
  const parsedBody = parseBody(rawBody);

  if (!res.ok) {
    throw new ChatApiError(
      extractErrorMessage(parsedBody) ?? "Chat request failed",
      res.status,
      parsedBody
    );
  }

  if (parsedBody && typeof parsedBody === "object") {
    return parsedBody as ChatResponse;
  }

  throw new Error("Invalid chat response");
}

/** Parsed body from POST .../messages/{id}/rate (ChatMessageResponse) */
export type RateMessageResult = {
  messageId?: string;
  rating?: number | null;
};

export async function rateMessage(
  messageId: string,
  rating: "helpful" | "not-helpful"
): Promise<RateMessageResult> {
  if (!isRatingMessageId(messageId)) {
    throw new Error("Invalid assistant message id for rating (expected server UUID).");
  }
  const numericRating = rating === "helpful" ? 5 : 1;
  console.log(`📤 Sending rating request: POST ${CHATBOT_BASE}/messages/${messageId}/rate`, {
    rating: numericRating,
  });
  const res = await fetchWithAuth(
    `${CHATBOT_BASE}/messages/${messageId}/rate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: numericRating }),
    }
  );
  const rawBody = await res.text().catch(() => "");
  const parsedBody = parseBody(rawBody);
  if (!res.ok) {
    const errorText =
      typeof parsedBody === "string" && parsedBody.trim()
        ? parsedBody.trim()
        : (extractErrorMessage(parsedBody) ?? rawBody) || "Unknown error";
    console.error(`❌ Rating API failed (${res.status}):`, errorText);
    throw new Error(`Failed to submit rating: ${errorText}`);
  }
  console.log("✅ Rating API success");
  if (parsedBody && typeof parsedBody === "object") {
    const r = parsedBody as Record<string, unknown>;
    const rid = r.messageId;
    const rt = r.rating;
    return {
      messageId: typeof rid === "string" ? rid : undefined,
      rating: typeof rt === "number" ? rt : rt === null ? null : undefined,
    };
  }
  return {};
}

export async function chatbotHealth(): Promise<string> {
  const res = await fetchWithAuth(`${CHATBOT_BASE}/health`);
  if (!res.ok) throw new Error("Chatbot health check failed");
  return res.text();
}

// GET /api/v1/chatbot/history
export async function getConversations(): Promise<ConversationSummary[]> {
  const res = await fetchWithAuth(`${CHATBOT_BASE}/history?page=0&size=50`);
  if (!res.ok) return [];
  const data = await res.json();
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : (data.content ?? []);
  return items.map((c) => ({
    id: String(c.conversationId ?? ""),
    title: String(c.title ?? ""),
    status: String(c.status ?? ""),
    startedAt: String(c.startedAt ?? ""),
    lastMessageAt: String(c.lastMessageAt ?? ""),
    totalMessages: Number(c.totalMessages ?? 0),
  }));
}

// GET /api/v1/chatbot/history/{id}
export async function getConversationHistory(conversationId: string): Promise<ChatHistoryResponse | null> {
  const res = await fetchWithAuth(`${CHATBOT_BASE}/history/${conversationId}`);
  if (!res.ok) return null;
  return res.json();
}

// PUT /api/v1/chatbot/history/{id}/end
export async function endConversation(conversationId: string): Promise<void> {
  await fetchWithAuth(`${CHATBOT_BASE}/history/${conversationId}/end`, { method: "PUT" });
}
