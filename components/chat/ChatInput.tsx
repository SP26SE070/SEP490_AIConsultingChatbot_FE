"use client";

import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { useLanguageStore } from "@/lib/language-store";
import { ChatbotSpinner } from "@/components/chat/ChatbotEntryLoading";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: ChatInputProps) {
  const { language } = useLanguageStore();
  const isEn = language === "en";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <form onSubmit={onSubmit} className="mx-auto max-w-4xl">
        <div className="flex items-stretch gap-3">
          <div className="flex h-11 flex-1">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={isEn ? "How can the AI chatbot help you?" : "Làm thế nào để AI chatbot có thể giúp bạn?"}
              rows={1}
              className="h-11 w-full resize-none overflow-hidden rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center self-stretch rounded-lg bg-green-500 text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <ChatbotSpinner size="sm" tone="inverse" />
            ) : (
              <ArrowRightIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-zinc-500">
          {isEn
            ? "AI can make mistakes. Verify important information."
            : "AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng."}
        </p>
      </form>
    </div>
  );
}

