"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MessageSquare, Clock, X } from "lucide-react";
import { useLanguageStore } from "@/lib/language-store";
import { getConversations } from "@/lib/api/chatbot";
import { ChatbotEntryLoading } from "@/components/chat/ChatbotEntryLoading";

interface ConversationListItem {
  id: string;
  title?: string;
  createdAt: string;
  lastMessageAt?: string;
}

interface ChatHistorySidebarNewProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  currentChatId: string | null;
  /** Increment after a new message is sent to refresh the list */
  refreshTrigger?: number;
}

/** Side panel lives inside chat content area to avoid transform/fixed offset drift. */
export function ChatHistorySidebarNew({
  isOpen,
  onClose,
  onNewChat,
  onSelectChat,
  currentChatId,
  refreshTrigger = 0,
}: ChatHistorySidebarNewProps) {
  const { language } = useLanguageStore();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getConversations();
      setConversations(
        rows
          .filter((c) => c.id)
          .map((c) => ({
            id: c.id,
            title: c.title || undefined,
            createdAt: c.startedAt || new Date().toISOString(),
            lastMessageAt: c.lastMessageAt || c.startedAt,
          }))
      );
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadConversations();
    }
  }, [isOpen, refreshTrigger, loadConversations]);

  const groupByDate = (convs: ConversationListItem[]) => {
    const today: ConversationListItem[] = [];
    const past7Days: ConversationListItem[] = [];
    const older: ConversationListItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const past7DaysStart = new Date(todayStart);
    past7DaysStart.setDate(past7DaysStart.getDate() - 7);

    convs.forEach((conv) => {
      const convDate = new Date(conv.lastMessageAt || conv.createdAt);
      if (convDate >= todayStart) {
        today.push(conv);
      } else if (convDate >= past7DaysStart) {
        past7Days.push(conv);
      } else {
        older.push(conv);
      }
    });

    return { today, past7Days, older };
  };

  const { today, past7Days, older } = groupByDate(conversations);

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        aria-hidden={!isOpen}
        className={`fixed left-16 top-0 z-50 ml-0 flex h-dvh flex-col border-l-0 border-r border-zinc-200 bg-white shadow-md transition-[width,opacity] duration-300 ease-out will-change-[width,opacity] dark:border-zinc-800 dark:bg-zinc-950 ${
          isOpen
            ? "w-[260px] opacity-100"
            : "pointer-events-none w-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
            <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {language === "en" ? "Chat history" : "Lịch sử chat"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              aria-label={language === "en" ? "Close" : "Đóng"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="shrink-0 p-3 pb-2">
            <button
              type="button"
              onClick={() => onNewChat()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {language === "en" ? "New chat" : "Chat mới"}
            </button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {loading ? (
              <ChatbotEntryLoading variant="sidebar" />
            ) : (
              <div className="space-y-4 pb-2">
                {today.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-3 w-3 shrink-0" />
                      {language === "en" ? "Today" : "Hôm nay"}
                    </div>
                    <div className="space-y-1">
                      {today.map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => onSelectChat(conv.id)}
                          className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                            currentChatId === conv.id
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="truncate text-sm font-medium">
                              {conv.title || (language === "en" ? "New conversation" : "Cuộc trò chuyện mới")}
                            </div>
                            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(conv.lastMessageAt || conv.createdAt).toLocaleTimeString(
                                language === "vi" ? "vi-VN" : "en-US",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {past7Days.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-3 w-3 shrink-0" />
                      {language === "en" ? "Past 7 Days" : "7 ngày qua"}
                    </div>
                    <div className="space-y-1">
                      {past7Days.map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => onSelectChat(conv.id)}
                          className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                            currentChatId === conv.id
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="truncate text-sm font-medium">
                              {conv.title || (language === "en" ? "New conversation" : "Cuộc trò chuyện mới")}
                            </div>
                            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString(
                                language === "vi" ? "vi-VN" : "en-US"
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {older.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <Clock className="h-3 w-3 shrink-0" />
                      {language === "en" ? "Older" : "Cũ hơn"}
                    </div>
                    <div className="space-y-1">
                      {older.map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => onSelectChat(conv.id)}
                          className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                            currentChatId === conv.id
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="truncate text-sm font-medium">
                              {conv.title || (language === "en" ? "New conversation" : "Cuộc trò chuyện mới")}
                            </div>
                            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString(
                                language === "vi" ? "vi-VN" : "en-US"
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {conversations.length === 0 && !loading && (
                  <div className="py-8 text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-zinc-400" />
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {language === "en" ? "No conversations yet" : "Chưa có cuộc trò chuyện"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-zinc-100 p-3 dark:border-zinc-800/80">
            <p className="text-center text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              {language === "en"
                ? "Chat history is saved up to 30 days"
                : "Lịch sử chat được lưu tối đa 30 ngày"}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
