"use client";

import { useState, useEffect } from "react";
import type { Message } from "@/types/chat";
import { AIBoxSidebar } from "@/components/chat/AIBoxSidebar";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import { ErrorNotice } from "@/components/ui";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, ThumbsUp, ThumbsDown, FileText, MessageSquare } from "lucide-react";
import { toUiErrorMessage } from "@/lib/api/parseApiError";
import { chat, chatbotHealth, getConversationHistory, rateMessage } from "@/lib/api/chatbot";
import { isRatingMessageId, resolveServerMessageId } from "@/lib/chatMessageId";
import { mapServerRatingToUi } from "@/lib/chatRating";
import type { ChatMessageResponse } from "@/types/chatbot";
import { ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";

export default function ChatPlatformPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'error' | 'checking'>('checking');

  const INPUT_CHAR_LIMIT = 500;
  const INPUT_WARNING_THRESHOLD = 450;

  // Check chatbot health on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await chatbotHealth();
        setHealthStatus('healthy');
      } catch {
        setHealthStatus('error');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 1500); // Near real-time health sync
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = currentQuestion.trim();
    if (!question) return;

    setError(null);
    setIsLoading(true);
    const userMessageId = Date.now().toString();

    try {
      const response = await chat({
        message: question,
        conversationId: conversationId ?? undefined,
      });

      console.log("API Response:", response);
      console.log("Sources:", response.sources);

      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      const references = (response.sources ?? []).map((s) => ({
        documentId: s.documentId,
        documentName: s.fileName,
        excerpt: s.chunkContent ?? "",
        confidence: s.relevanceScore,
      }));

      console.log("Mapped references:", references);

      // Fetch conversation history to get real message ID from backend
      let realMessageId = userMessageId; // fallback
      let assistantServerRating: Message["rating"] = null;
      if (response.conversationId) {
        try {
          console.log("🔍 Fetching conversation history for ID:", response.conversationId);
          const history = await getConversationHistory(response.conversationId);
          console.log("📥 History response:", history);
          if (history?.messages?.length) {
            console.log("📝 Total messages in history:", history.messages.length);
            // Get the last assistant message (most recent)
            const lastAssistantMsg = [...history.messages]
              .reverse()
              .find((m) => m.role === "ASSISTANT");
            console.log("🤖 Last assistant message:", lastAssistantMsg);
            const msgId = lastAssistantMsg ? resolveServerMessageId(lastAssistantMsg) : undefined;
            if (msgId) {
              realMessageId = msgId;
              console.log("✅ Got real message ID from backend:", realMessageId);
            } else {
              console.warn("⚠️ No assistant message ID found in history");
            }
            const mapped = lastAssistantMsg ? mapServerRatingToUi(lastAssistantMsg.rating) : undefined;
            assistantServerRating = mapped ?? null;
          } else {
            console.warn("⚠️ History is empty or invalid");
          }
        } catch (e) {
          console.error("❌ Failed to fetch message ID:", e);
        }
      } else {
        console.warn("⚠️ No conversationId in response");
      }

      const newMessage: Message = {
        id: realMessageId,
        question,
        answer: response.answer,
        references,
        timestamp: new Date(),
        rating: assistantServerRating,
      };

      setMessages((prev) => [...prev, newMessage]);
      setCurrentQuestion("");
    } catch (err) {
      let errorMessage = "Không thể kết nối tới chatbot. Vui lòng thử lại.";
      
      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        
        // Check for 429 (daily limit)
        if (message.includes("429") || message.includes("giới hạn")) {
          errorMessage = "Bạn đã đạt giới hạn tin nhắn hôm nay. Vui lòng thử lại vào ngày mai.";
        }
        // Check for message too long
        else if (message.includes("quá dài") || message.includes("too long")) {
          errorMessage = "Tin nhắn quá dài. Vui lòng rút ngắn nội dung dưới 500 ký tự.";
        }
        // Use original error message if available
        else if (err.message) {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      const fallbackMessage: Message = {
        id: userMessageId,
        question,
        answer: `**Lỗi:** ${errorMessage}\n\nKiểm tra kết nối mạng hoặc liên hệ quản trị viên nếu lỗi tiếp tục.`,
        references: [],
        timestamp: new Date(),
        rating: null,
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRate = async (messageId: string, rating: "helpful" | "not-helpful") => {
    console.log("🔵 Rating message:", { messageId, rating });

    const currentMessage = messages.find(m => m.id === messageId);
    const previousRating: Message["rating"] = currentMessage?.rating ?? null;

    // Backend now supports only binary ratings (5 helpful, 1 not-helpful), no unrate action.
    if (previousRating === rating) {
      console.log("ℹ️ Rating unchanged, skip request");
      return;
    }

    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, rating } : msg))
    );
    try {
      const result = await rateMessage(messageId, rating);
      const ui = mapServerRatingToUi(result.rating) ?? rating;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, rating: ui } : msg))
      );
      console.log("✅ Rating submitted successfully");
    } catch (e) {
      console.error("❌ Rating submission failed:", e);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, rating: previousRating } : msg))
      );
    }
  };

  return (
    <div className="flex h-dvh min-h-0 bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 dark:from-zinc-950 dark:via-black dark:to-emerald-950/20">
      <AIBoxSidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* FIXED HEADER with Subtle Health Status */}
        <div className="shrink-0 border-b border-zinc-200/50 bg-white/80 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            
            <div className="flex items-center gap-3">
              {/* Subtle Health Status */}
              <div className="group relative flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full transition-colors ${
                  healthStatus === 'healthy' ? 'bg-emerald-500' :
                  healthStatus === 'error' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {healthStatus === 'healthy' ? 'Online' :
                   healthStatus === 'error' ? 'Offline' :
                   'Connecting'}
                </span>
                
                {/* Tooltip on hover */}
                <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden w-56 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl group-hover:block dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 h-2 w-2 rounded-full ${
                      healthStatus === 'healthy' ? 'bg-emerald-500' :
                      healthStatus === 'error' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                        {healthStatus === 'healthy' ? 'AI Service Online' :
                         healthStatus === 'error' ? 'AI Service Offline' :
                         'Checking Status...'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {healthStatus === 'healthy' ? 'All systems operational' :
                         healthStatus === 'error' ? 'Service temporarily unavailable' :
                         'Connecting to chatbot service'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <MessageSquare className="h-4 w-4" />
                Trò chuyện
              </button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
          {/* ERROR MESSAGE */}
          {error && (
            <div className="mx-auto mb-4 w-full max-w-4xl">
              <ErrorNotice message={error} />
            </div>
          )}

          {/* RESULTS */}
          <div className="mx-auto max-w-4xl space-y-10">
            {messages.length === 0 ? (
              <div>
                {/* Colorful Header */}
                <div className="animate-gradient relative mb-10 overflow-hidden rounded-2xl bg-[length:220%_220%] bg-gradient-to-r from-lime-400 via-fuchsia-500 via-emerald-400 to-violet-600 px-5 py-4 shadow-md shadow-fuchsia-500/15 dark:shadow-lg dark:shadow-emerald-500/25">
                  <div className="pointer-events-none absolute inset-0 bg-black/20 dark:bg-black/10" />
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-12 left-1/4 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                        <MessageSquare className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h1 className="text-lg font-semibold text-white sm:text-xl">
                          Internal AI Consulting Chatbot
                        </h1>
                        <p className="mt-1 text-xs text-white/90 sm:text-sm">
                          Ask questions in English • RAG-powered • Based on company documents
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                    <MessageSquare className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    How can I help you today?
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Ask me anything about your company policies, procedures, or documents.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="space-y-6">
                  {/* QUERY */}
                  <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {msg.question}
                  </div>

                  {/* ANSWER */}
                  <div className="space-y-4">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-50">
                      {msg.answer}
                    </p>

                    {/* INLINE SOURCES */}
                    {msg.references && msg.references.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.references.map((ref, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
                          >
                            <FileText className="h-3 w-3" />
                            {ref.documentName}
                            {ref.confidence && (
                              <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                                {Math.round(ref.confidence * 100)}%
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FEEDBACK */}
                  {isRatingMessageId(msg.id) ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRate(msg.id, "helpful")}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition ${
                        msg.rating === "helpful"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Useful
                    </button>
                    <button
                      onClick={() => handleRate(msg.id, "not-helpful")}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition ${
                        msg.rating === "not-helpful"
                          ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Not useful
                    </button>
                  </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* FIXED INPUT AT BOTTOM */}
        <div className="shrink-0 border-t border-zinc-200/50 bg-white/80 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/80">
          <div className="mx-auto max-w-4xl px-4 py-4 md:px-6">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-300 bg-white px-4 py-3 shadow-lg transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900">
                <input
                  type="text"
                  value={currentQuestion}
                  onChange={(e) => setCurrentQuestion(e.target.value)}
                  placeholder="Ask anything about your company..."
                  disabled={isLoading}
                  maxLength={INPUT_CHAR_LIMIT}
                  className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none disabled:opacity-50 dark:text-zinc-50 dark:placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={isLoading || !currentQuestion.trim() || currentQuestion.length > INPUT_CHAR_LIMIT}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isLoading ? (
                    <ChatbotSpinner size="sm" tone="inverse" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  AI may produce incorrect answers. Verify critical information.
                </p>
                <span
                  className={`text-xs ${
                    currentQuestion.length > INPUT_WARNING_THRESHOLD
                      ? "text-red-500 dark:text-red-400"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {currentQuestion.length}/{INPUT_CHAR_LIMIT}
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ChatHistorySidebar
        open={isHistoryOpen}
        onToggle={() => setIsHistoryOpen(false)}
        onSelectChat={(chatId) => {
          setCurrentChatId(chatId || null);
          if (chatId) {
            getConversationHistory(chatId).then((history) => {
              if (history) {
                const msgs: Message[] = [];
                for (let i = 0; i < history.messages.length; i += 2) {
                  const userMsg = history.messages[i];
                  const aiMsg = history.messages[i + 1];
                  const rating = mapServerRatingToUi(aiMsg?.rating) ?? null;

                  msgs.push({
                    id:
                      resolveServerMessageId(aiMsg as ChatMessageResponse) ??
                      resolveServerMessageId(userMsg as ChatMessageResponse) ??
                      "",
                    question: userMsg?.content ?? "",
                    answer: aiMsg?.content ?? "",
                    references: (aiMsg?.sources ?? []).map((s) => ({
                      documentId: s.documentId,
                      documentName: s.fileName,
                      excerpt: s.chunkContent ?? "",
                      confidence: s.relevanceScore,
                    })),
                    timestamp: new Date(aiMsg?.createdAt ?? userMsg?.createdAt ?? new Date()),
                    rating,
                  });
                }
                setMessages(msgs);
              }
            });
          } else {
            setMessages([]);
          }
        }}
        onNewChat={() => {
          setConversationId(null);
          setMessages([]);
          setCurrentChatId(null);
        }}
        currentChatId={currentChatId}
        showToggleButton={false}
      />
    </div>
  );
}
