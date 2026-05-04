/** Request: POST /api/v1/chatbot/chat */
export interface ChatRequest {
  message: string;
  conversationId?: string | null;
  topK?: number | null;
  categoryId?: string | null;
  tagIds?: string[] | null;
  /** Khi hỏi trong ngữ cảnh một tài liệu (BE kiểm tra quyền + lọc chunk theo doc). */
  targetDocumentId?: string | null;
}

/** Source from RAG (one chunk) */
export interface ChatSourceDocument {
  documentId: string;
  fileName: string;
  chunkContent: string;
  chunkIndex?: number;
  relevanceScore: number;
}

/** Response: POST /api/v1/chatbot/chat */
export interface ChatResponse {
  answer: string;
  conversationId: string;
  sources: ChatSourceDocument[];
  responseTimeMs: number;
}

// GET /api/v1/chatbot/history
export interface ConversationSummary {
  id: string;
  title: string;
  status: string;
  startedAt: string;
  lastMessageAt: string;
  totalMessages: number;
}

// Source from conversation history
export interface SourceDocument {
  documentId: string;
  fileName: string;
  chunkContent: string;
  chunkIndex?: number;
  relevanceScore: number;
}

// GET /api/v1/chatbot/history/{id}
export interface ChatMessageResponse {
  /** Present depending on API / Jackson naming */
  id?: string;
  messageId?: string;
  role: "USER" | "ASSISTANT";
  content: string;
  /** `sources` from chat API; `sourceChunks` from persisted history API */
  sources?: SourceDocument[] | null;
  sourceChunks?: SourceDocument[] | null;
  rating: number | null;
  createdAt: string;
}

export interface ChatHistoryResponse {
  id: string;
  title: string;
  status: string;
  messages: ChatMessageResponse[];
}
