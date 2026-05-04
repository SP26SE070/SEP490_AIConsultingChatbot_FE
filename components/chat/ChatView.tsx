"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Sparkles,
  ExternalLink,
  FileText,
  Search,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Briefcase,
  CalendarDays,
  HeartHandshake,
} from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { ChatHistorySidebarNew } from "./ChatHistorySidebarNew";
import { ChatbotAssistantTyping, ChatbotSpinner } from "./ChatbotEntryLoading";
import { getStoredUser } from "@/lib/auth-store";
import { getProfile } from "@/lib/api/profile";
import { chat, ChatApiError, getConversationHistory, rateMessage } from "@/lib/api/chatbot";
import { isRatingMessageId, resolveServerMessageId } from "@/lib/chatMessageId";
import { mapServerRatingToUi } from "@/lib/chatRating";
import { listTagsActive } from "@/lib/api/tags";
import type { DocumentTagResponse } from "@/types/knowledge";

const INPUT_CHAR_LIMIT = 500;
const INPUT_WARNING_THRESHOLD = 450;

function extractAnswerFromApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const answer = (data as { answer?: unknown }).answer;
  return typeof answer === "string" ? answer : "";
}

function looksLikeTooLongError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("quá dài") || normalized.includes("too long");
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: {
    documentId?: string;
    documentName: string;
    confidence?: number;
  }[];
  timestamp: Date;
  rating?: "helpful" | "not-helpful";
}

export interface ChatViewProps {
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  onNavigateToSearch: (query?: string) => void;
}

export function ChatView({
  isHistoryOpen,
  onToggleHistory,
  onNavigateToSearch,
}: ChatViewProps) {
  const { language } = useLanguageStore();
  const isEn = language === "en";
  const currentUser = getStoredUser();
  const [displayName, setDisplayName] = useState(
    currentUser?.email?.split("@")[0] || (isEn ? "You" : "Bạn")
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<{
    documentId?: string;
    documentName: string;
    confidence?: number;
  } | null>(null);
  const [tags, setTags] = useState<DocumentTagResponse[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile?.fullName?.trim()) setDisplayName(profile.fullName.trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    listTagsActive()
      .then((activeTags) => setTags(activeTags))
      .catch(() => setTags([]));
  }, []);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleNewChat = () => {
    setConversationId(null);
    setCurrentChatId(null);
    setMessages([]);
    setSelectedSource(null);
    setError(null);
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    getConversationHistory(chatId).then((history) => {
      console.log("📥 Conversation history loaded:", history);
      
      if (!history?.messages?.length) {
        setMessages([]);
        setConversationId(chatId);
        return;
      }
      const built: Message[] = [];
      const msgs = history.messages;
      
      console.log("📋 Raw messages from API:", msgs.map(m => ({
        id: m.id,
        messageId: m.messageId,
        role: m.role,
        rating: m.rating,
        content: m.content.substring(0, 50)
      })));
      
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].role === "USER") {
          const userMsg = msgs[i];
          const assistantMsg = msgs[i + 1]?.role === "ASSISTANT" ? msgs[i + 1] : null;
          const userId = resolveServerMessageId(userMsg) ?? `user-${i}-${Date.now()}`;
          built.push({
            id: userId,
            role: "user",
            content: userMsg.content,
            timestamp: new Date(userMsg.createdAt ?? Date.now()),
          });
          if (assistantMsg) {
            // Convert rating: 5 = helpful, 1 = not-helpful, null = no rating
            let rating: "helpful" | "not-helpful" | undefined;
            if (assistantMsg.rating === 5) {
              rating = "helpful";
            } else if (assistantMsg.rating === 1) {
              rating = "not-helpful";
            }

            const assistantId = resolveServerMessageId(assistantMsg) ?? `assistant-${i}-${Date.now()}`;

            console.log(`🔄 Converting assistant message rating:`, {
              messageId: assistantId,
              rawRating: assistantMsg.rating,
              convertedRating: rating,
            });

            built.push({
              id: assistantId,
              role: "assistant",
              content: assistantMsg.content,
              sources: (assistantMsg.sources ?? []).map((s) => ({
                documentId: s.documentId,
                documentName: s.fileName,
                confidence: s.relevanceScore,
              })),
              timestamp: new Date(assistantMsg.createdAt ?? Date.now()),
              rating,
            });
            i++;
          }
        }
      }
      
      console.log("✅ Built messages:", built.map(m => ({
        id: m.id,
        role: m.role,
        rating: m.rating,
        content: m.content.substring(0, 50)
      })));
      
      setMessages(built);
      setSelectedSource(null);
      setConversationId(chatId);
      setError(null);
    });
  };

  const handleRate = async (messageId: string, rating: "helpful" | "not-helpful") => {
    console.log("🔵 Rating message:", { messageId, rating });
    console.log("📋 Current messages:", messages.map(m => ({ id: m.id, role: m.role, rating: m.rating })));

    const currentMessage = messages.find(m => m.id === messageId);
    const previousRating: Message["rating"] = currentMessage?.rating;

    // Backend now supports only binary ratings (5 helpful, 1 not-helpful), no unrate action.
    if (previousRating === rating) {
      console.log("ℹ️ Rating unchanged, skip request");
      return;
    }

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          console.log("✅ Found matching message to update:", msg.id);
          return { ...msg, rating };
        }
        return msg;
      })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await chat({
        message: text,
        conversationId: conversationId ?? undefined,
        tagIds: selectedTagIds.length ? selectedTagIds : undefined,
      });

      if (response.conversationId) {
        setConversationId(response.conversationId);
        setCurrentChatId(response.conversationId);
        setHistoryRefresh((n) => n + 1);
      }

      const rawAnswer = response.answer ?? "";
      const looksLikeError =
        rawAnswer.includes("I apologize, but I encountered an error") ||
        rawAnswer.toLowerCase().includes("encountered an error");

      const answerText = looksLikeError
        ? isEn
          ? "Sorry, the system is busy. Please try again later."
          : "Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau."
        : rawAnswer;

      // Fetch conversation history to get real message IDs from backend
      let realMessageId = (Date.now() + 1).toString(); // fallback
      let assistantServerRating: Message["rating"] | undefined = undefined;
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
            console.log("⭐ Message rating:", lastAssistantMsg?.rating);
            console.log("📊 Full message details:", {
              messageId: lastAssistantMsg?.messageId,
              rating: lastAssistantMsg?.rating,
              hasRating: lastAssistantMsg?.rating !== undefined && lastAssistantMsg?.rating !== null
            });
            const msgId = lastAssistantMsg ? resolveServerMessageId(lastAssistantMsg) : undefined;
            if (msgId) {
              realMessageId = msgId;
              console.log("✅ Got real message ID from backend:", realMessageId);
            } else {
              console.warn("⚠️ No assistant message ID found in history");
            }
            assistantServerRating = lastAssistantMsg
              ? mapServerRatingToUi(lastAssistantMsg.rating)
              : undefined;
          } else {
            console.warn("⚠️ History is empty or invalid");
          }
        } catch (e) {
          console.error("❌ Failed to fetch message ID:", e);
        }
      } else {
        console.warn("⚠️ No conversationId in response");
      }

      const aiMessage: Message = {
        id: realMessageId,
        role: "assistant",
        content: answerText,
        sources: (response.sources ?? []).map((s) => ({
          documentId: s.documentId,
          documentName: s.fileName,
          confidence: s.relevanceScore,
        })),
        timestamp: new Date(),
        ...(assistantServerRating ? { rating: assistantServerRating } : {}),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      if (err instanceof ChatApiError) {
        const apiAnswer = extractAnswerFromApiError(err.data) || err.message;
        if (err.status === 429) {
          setError(
            isEn
              ? "You have reached today's message limit. Please try again tomorrow."
              : "Bạn đã đạt giới hạn tin nhắn hôm nay. Vui lòng thử lại vào ngày mai."
          );
          return;
        }
        if (err.status === 400 && looksLikeTooLongError(apiAnswer)) {
          setError(
            isEn
              ? "Your message is too long. Please shorten it."
              : "Tin nhắn quá dài. Vui lòng rút ngắn nội dung."
          );
          return;
        }
      }

      setError(isEn ? "Failed to get a response from the chatbot." : "Không thể nhận phản hồi từ chatbot.");
      const fallback: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: isEn
          ? "Sorry, the system is busy. Please try again later."
          : "Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallback]);
    } finally {
      setIsLoading(false);
    }
  };

  const examplePrompts: { text: string; Icon: typeof Briefcase }[] = [
    {
      text: isEn ? "What is the remote work policy?" : "Chính sách làm việc từ xa là gì?",
      Icon: Briefcase,
    },
    {
      text: isEn ? "How do I request time off?" : "Làm thế nào để xin nghỉ phép?",
      Icon: CalendarDays,
    },
    {
      text: isEn ? "What are the company benefits?" : "Các quyền lợi của công ty là gì?",
      Icon: HeartHandshake,
    },
  ];

  const featurePills = isEn
    ? ["RAG answers", "Company documents", "Policies & HR"]
    : ["Trả lời RAG", "Tài liệu công ty", "Chính sách & HR"];

  const userLabel = isEn ? "You" : "Bạn";

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
      <ChatHistorySidebarNew
        isOpen={isHistoryOpen}
        onClose={onToggleHistory}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentChatId={currentChatId}
        refreshTrigger={historyRefresh}
      />

      <div
        ref={scrollRef}
        className="scrollbar-chat-hidden relative mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-6 overflow-y-auto scroll-smooth px-4 pb-5 pt-2 sm:flex-row sm:items-stretch sm:gap-8 sm:px-6 sm:pb-6 sm:pt-3"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-24 h-72 w-[min(90%,42rem)] -translate-x-1/2 rounded-full bg-violet-500/[0.07] blur-3xl dark:bg-violet-500/10"
          aria-hidden
        />

        <div className="relative mr-auto flex min-h-0 w-full min-w-0 max-w-6xl flex-1 flex-col rounded-3xl border border-zinc-200/80 bg-white/90 shadow-2xl shadow-zinc-900/[0.04] ring-1 ring-black/[0.03] backdrop-blur-xl dark:border-zinc-700/50 dark:bg-zinc-950/75 dark:shadow-black/40 dark:ring-white/[0.06] sm:rounded-[1.75rem]">
            <div className="flex min-h-full flex-1 flex-col p-5 sm:p-8">
              {error ? (
                <div className="mb-4 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100">
                  {error}
                </div>
              ) : null}

              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-6 sm:min-h-[min(70vh,28rem)] sm:py-10">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 animate-pulse rounded-3xl bg-emerald-500/20 blur-xl" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/35 ring-4 ring-emerald-500/15">
                      <Sparkles className="h-10 w-10 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <h2 className="mb-2 text-center text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                    {isEn ? "Hello" : "Xin chào"},{" "}
                    <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-violet-500 bg-clip-text text-transparent">
                      {displayName}
                    </span>
                  </h2>
                  <p className="mb-5 max-w-xl text-center text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
                    {isEn
                      ? "Ask about policies, HR, IT, and internal knowledge — answers cite your org documents."
                      : "Hỏi về chính sách, HR, IT và tri thức nội bộ — câu trả lời dựa trên tài liệu tổ chức."}
                  </p>
                  <div className="mb-8 flex flex-wrap justify-center gap-2">
                    {featurePills.map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-zinc-200/90 bg-zinc-50/90 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-600/60 dark:bg-zinc-900/60 dark:text-zinc-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                    {isEn ? "Try asking" : "Thử hỏi"}
                  </p>
                  <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
                    {examplePrompts.map(({ text, Icon }, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInput(text)}
                        className="group flex flex-col gap-3 rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/80 p-4 text-left shadow-sm transition hover:border-violet-300/80 hover:shadow-md hover:shadow-violet-500/10 dark:border-zinc-700/70 dark:from-zinc-900/90 dark:to-zinc-950/90 dark:hover:border-violet-500/40 dark:hover:shadow-violet-900/20"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/15 transition group-hover:bg-emerald-500/10 group-hover:text-emerald-600 group-hover:ring-emerald-500/20 dark:text-violet-300 dark:group-hover:text-emerald-300">
                          <Icon className="h-5 w-5" strokeWidth={2} />
                        </span>
                        <span className="text-[13px] font-medium leading-snug text-zinc-800 dark:text-zinc-200">
                          {text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8 pb-6">
                  {messages.map((message) => (
                    <div key={message.id} className="flex gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                          message.role === "user"
                            ? "bg-zinc-200 ring-1 ring-zinc-300/80 dark:bg-zinc-800 dark:ring-zinc-600/60"
                            : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-600/25 ring-1 ring-white/20"
                        }`}
                      >
                        {message.role === "user" ? (
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <Sparkles className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                          {message.role === "user" ? userLabel : isEn ? "AI Assistant" : "Trợ lý AI"}
                        </div>
                        <div
                          className={`rounded-2xl px-0 py-1 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-900 dark:text-white ${
                            message.role === "assistant"
                              ? "border border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-white px-4 py-3.5 dark:border-zinc-700/60 dark:from-zinc-900/80 dark:to-zinc-950/90"
                              : ""
                          }`}
                        >
                          {message.content}
                        </div>
                        {message.sources && message.sources.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.sources.map((source, idx) => (
                              <button
                                key={`${source.documentName}-${idx}`}
                                type="button"
                                onClick={() => setSelectedSource(source)}
                                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-violet-300/70 hover:bg-violet-50/80 dark:border-zinc-700/60 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-violet-500/40 dark:hover:bg-violet-950/30"
                              >
                                <span>{source.documentName}</span>
                                {source.confidence != null ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    {Math.round(
                                      source.confidence <= 1
                                        ? source.confidence * 100
                                        : source.confidence
                                    )}
                                    %
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {message.role === "assistant" && isRatingMessageId(message.id) && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRate(message.id, "helpful")}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                message.rating === "helpful"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
                              }`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              {isEn ? "Helpful" : "Hữu ích"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRate(message.id, "not-helpful")}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                message.rating === "not-helpful"
                                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:border-red-300 hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-red-700 dark:hover:bg-red-950/30"
                              }`}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                              {isEn ? "Not helpful" : "Không hữu ích"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading ? <ChatbotAssistantTyping /> : null}
                </div>
              )}

              <div className="mt-auto border-t border-zinc-200/80 pt-5 dark:border-zinc-700/50">
                {tags.length > 0 ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                      {isEn ? "Scope" : "Phạm vi"}
                    </span>
                    {tags.map((tag) => {
                      const on = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            on
                              ? "border-violet-500/70 bg-violet-500/15 text-violet-800 shadow-sm shadow-violet-500/10 dark:border-violet-400/50 dark:bg-violet-500/20 dark:text-violet-100"
                              : "border-zinc-200/90 bg-zinc-50/80 text-zinc-600 hover:border-zinc-300 dark:border-zinc-600/60 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:border-zinc-500"
                          }`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <form onSubmit={handleSubmit}>
                  <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-1.5 shadow-inner shadow-zinc-900/[0.02] ring-1 ring-black/[0.02] dark:border-zinc-600/50 dark:bg-zinc-900/60 dark:ring-white/[0.04]">
                    <div className="flex items-end gap-2 rounded-[0.9rem] border border-transparent bg-white/95 p-2 focus-within:border-violet-400/35 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12)] dark:bg-zinc-950/80 dark:focus-within:border-violet-500/30">
                      <button
                        type="button"
                        className="rounded-xl p-2.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        aria-label="Attach"
                      >
                        <Paperclip className="h-5 w-5" />
                      </button>
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSubmit(e);
                          }
                        }}
                        placeholder={
                          isEn ? "Ask about policies, HR, IT…" : "Hỏi về chính sách, HR, IT…"
                        }
                        rows={1}
                        maxLength={INPUT_CHAR_LIMIT}
                        className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent py-2.5 text-[15px] text-zinc-900 placeholder-zinc-500 outline-none dark:text-white dark:placeholder-zinc-500"
                      />
                      <button
                        type="submit"
                        disabled={!input.trim() || isLoading || input.length > INPUT_CHAR_LIMIT}
                        className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 text-white shadow-md shadow-emerald-600/25 transition hover:from-emerald-400 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                      >
                        {isLoading ? (
                          <ChatbotSpinner size="sm" tone="inverse" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex min-h-[18px] items-center justify-between gap-3">
                    {conversationId ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                        <span>{isEn ? "Conversation memory on" : "Đã bật bộ nhớ hội thoại"}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-transparent">memory</span>
                    )}
                    <span
                      className={`tabular-nums text-xs ${
                        input.length > INPUT_WARNING_THRESHOLD
                          ? "font-medium text-red-500 dark:text-red-400"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {input.length}/{INPUT_CHAR_LIMIT}
                    </span>
                  </div>
                </form>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                  {isEn
                    ? "AI can make mistakes. Verify important information."
                    : "AI có thể mắc lỗi. Hãy xác minh thông tin quan trọng."}
                </p>
              </div>
            </div>
          </div>

          <aside className="sticky top-4 hidden w-[min(100%,20rem)] shrink-0 space-y-5 xl:block">
            <div className="rounded-3xl border border-zinc-200/80 bg-white/75 p-5 shadow-xl shadow-zinc-900/[0.03] ring-1 ring-black/[0.02] backdrop-blur-md dark:border-zinc-700/50 dark:bg-zinc-950/70 dark:ring-white/[0.05]">
              <div className="mb-3 flex items-center gap-2 text-zinc-900 dark:text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/15 dark:text-violet-300">
                  <FileText className="h-4 w-4" strokeWidth={2} />
                </span>
                <h3 className="text-sm font-bold tracking-tight">
                  {isEn ? "Related documents" : "Tài liệu liên quan"}
                </h3>
              </div>
              {selectedSource ? (
                <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <p className="font-medium text-zinc-900 dark:text-white">{selectedSource.documentName}</p>
                  {selectedSource.confidence != null ? (
                    <p className="text-xs text-zinc-500">
                      {isEn ? "Relevance" : "Độ liên quan"}:{" "}
                      {Math.round(
                        selectedSource.confidence <= 1
                          ? selectedSource.confidence * 100
                          : selectedSource.confidence
                      )}
                      %
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onNavigateToSearch(selectedSource.documentName)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {isEn ? "Open in Search" : "Mở trong Tìm kiếm"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {isEn
                    ? "Select a source chip from an answer to see details and open it in Search."
                    : "Chọn một nguồn trong câu trả lời để xem chi tiết và mở ở mục Tìm kiếm."}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-emerald-200/50 bg-gradient-to-b from-emerald-50/90 to-white/90 p-5 shadow-lg shadow-emerald-900/[0.04] ring-1 ring-emerald-500/10 backdrop-blur-md dark:border-emerald-900/30 dark:from-emerald-950/25 dark:to-zinc-950/80 dark:ring-emerald-500/10">
              <div className="mb-3 flex items-center gap-2 text-zinc-900 dark:text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                  <Lightbulb className="h-4 w-4" strokeWidth={2} />
                </span>
                <h3 className="text-sm font-bold tracking-tight">{isEn ? "Tips" : "Gợi ý"}</h3>
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <li>
                  {isEn
                    ? "Use the Search tab for full document lookup and preview."
                    : "Dùng tab Tìm kiếm để tra cứu và xem trước tài liệu đầy đủ."}
                </li>
              </ul>
              <button
                type="button"
                onClick={() => onNavigateToSearch()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/60 bg-white/90 px-3 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50/90 dark:border-emerald-700/50 dark:bg-zinc-900/80 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
              >
                <Search className="h-4 w-4" />
                {isEn ? "Open Search tab" : "Mở mục Tìm kiếm"}
              </button>
            </div>
          </aside>
      </div>
    </div>
  );
}
