"use client";

import { useEffect, useState } from "react";
import {
  getChatbotConfig,
  updateChatbotConfig,
  type ChatbotMode,
  type EmbeddingProvider,
} from "@/lib/api/chatbot-config";
import { getTenantFeedback, type FeedbackAnalytics } from "@/lib/api/feedback";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { Sparkles, ThumbsUp, ThumbsDown, MessageSquare, Star, AlertTriangle } from "lucide-react";

export default function AIInsightsPage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const isEn = language === "en";

  const [mode, setMode] = useState<ChatbotMode>("BALANCED");
  const [originalMode, setOriginalMode] = useState<ChatbotMode>("BALANCED");
  const [embeddingProvider, setEmbeddingProvider] = useState<EmbeddingProvider>("GEMINI");
  const [originalEmbeddingProvider, setOriginalEmbeddingProvider] = useState<EmbeddingProvider>("GEMINI");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackAnalytics | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  useEffect(() => {
    getChatbotConfig()
      .then((config) => {
        setMode(config.mode);
        setOriginalMode(config.mode);
        setEmbeddingProvider(config.embeddingProvider ?? "GEMINI");
        setOriginalEmbeddingProvider(config.embeddingProvider ?? "GEMINI");
        setError(null);
      })
      .catch(() => {
        setMode("BALANCED");
        setOriginalMode("BALANCED");
        setEmbeddingProvider("GEMINI");
        setOriginalEmbeddingProvider("GEMINI");
        setError(isEn ? "Failed to load config. Using default settings." : "Không tải được cấu hình. Sử dụng cài đặt mặc định.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isEn]);

  useEffect(() => {
    getTenantFeedback(10)
      .then((data) => {
        setFeedback(data);
      })
      .catch((e) => {
        console.warn("Failed to load feedback:", e);
        setFeedback(null);
      })
      .finally(() => {
        setFeedbackLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await updateChatbotConfig({ mode, embeddingProvider });
      setOriginalMode(mode);
      setOriginalEmbeddingProvider(embeddingProvider);
      setSuccessMessage(isEn ? "Chatbot behavior updated successfully" : "Cập nhật hành vi chatbot thành công");
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to update. Please try again." : "Cập nhật thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = mode !== originalMode || embeddingProvider !== originalEmbeddingProvider;

  const renderStars = (rating: number) => {
    return Array.from({ length: rating }).map((_, i) => (
      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
    ));
  };

  const extractDocumentName = (sourceChunks?: any[]): string => {
    if (!sourceChunks || sourceChunks.length === 0) return "—";
    const first = sourceChunks[0];
    return first?.documentName || first?.fileName || "—";
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isEn ? "AI Insights" : "Thông tin AI"}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {isEn ? "Configure chatbot behavior and view performance metrics" : "Cấu hình hành vi chatbot và xem số liệu hiệu suất"}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Chatbot Behavior */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {isEn ? "Chatbot Behavior" : "Hành vi Chatbot"}
            </h2>
          </div>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            {isEn ? "Control how the AI retrieves answers for your company" : "Kiểm soát cách AI truy xuất câu trả lời cho công ty bạn"}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Balanced */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-purple-300 hover:bg-purple-50/50 dark:border-zinc-700 dark:hover:border-purple-700 dark:hover:bg-purple-950/20">
                <input
                  type="radio"
                  name="chatbot-mode"
                  value="BALANCED"
                  checked={mode === "BALANCED"}
                  onChange={(e) => setMode(e.target.value as ChatbotMode)}
                  disabled={loading || saving}
                  className="mt-1 h-4 w-4 shrink-0 text-purple-600 accent-purple-600 focus:outline-none focus:ring-0 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {isEn ? "Balanced" : "Cân bằng"}
                    </span>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                      {isEn ? "Recommended" : "Khuyến nghị"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Best for most cases. Reliable answers." : "Tốt nhất cho hầu hết trường hợp. Câu trả lời đáng tin cậy."}
                  </p>
                </div>
              </label>

              {/* Strict */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-purple-300 hover:bg-purple-50/50 dark:border-zinc-700 dark:hover:border-purple-700 dark:hover:bg-purple-950/20">
                <input
                  type="radio"
                  name="chatbot-mode"
                  value="STRICT"
                  checked={mode === "STRICT"}
                  onChange={(e) => setMode(e.target.value as ChatbotMode)}
                  disabled={loading || saving}
                  className="mt-1 h-4 w-4 shrink-0 text-purple-600 accent-purple-600 focus:outline-none focus:ring-0 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {isEn ? "Strict" : "Nghiêm ngặt"}
                  </span>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {isEn ? "More accurate. Only answers when confident." : "Chính xác hơn. Chỉ trả lời khi tự tin."}
                  </p>
                </div>
              </label>

              {/* Flexible */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-purple-300 hover:bg-purple-50/50 dark:border-zinc-700 dark:hover:border-purple-700 dark:hover:bg-purple-950/20">
                <input
                  type="radio"
                  name="chatbot-mode"
                  value="FLEXIBLE"
                  checked={mode === "FLEXIBLE"}
                  onChange={(e) => setMode(e.target.value as ChatbotMode)}
                  disabled={loading || saving}
                  className="mt-1 h-4 w-4 shrink-0 text-purple-600 accent-purple-600 focus:outline-none focus:ring-0 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {isEn ? "Flexible" : "Linh hoạt"}
                  </span>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {isEn ? "Answers more broadly. May include less relevant info." : "Trả lời rộng hơn. Có thể bao gồm thông tin ít liên quan."}
                  </p>
                </div>
              </label>

            </div>
          )}
        </div>

        {/* Section 2: Embedding Provider */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {isEn ? "Embedding Provider" : "Nhà cung cấp Embedding"}
            </h2>
          </div>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            {isEn
              ? "Choose one embedding engine for your tenant: Gemini cloud or MxBai Embed Large local."
              : "Chọn một engine embedding cho tenant: Gemini cloud hoặc MxBai Embed Large local."}
          </p>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-purple-300 hover:bg-purple-50/50 dark:border-zinc-700 dark:hover:border-purple-700 dark:hover:bg-purple-950/20">
              <input
                type="radio"
                name="embedding-provider"
                value="GEMINI"
                checked={embeddingProvider === "GEMINI"}
                onChange={(e) => setEmbeddingProvider(e.target.value as EmbeddingProvider)}
                disabled={loading || saving}
                className="mt-1 h-4 w-4 shrink-0 text-purple-600 accent-purple-600 focus:outline-none focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex-1">
                <div className="font-medium text-zinc-900 dark:text-white">Gemini</div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {isEn ? "Cloud embedding (default, fastest setup)." : "Embedding cloud (mặc định, chạy nhanh và ổn định)."}
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-purple-300 hover:bg-purple-50/50 dark:border-zinc-700 dark:hover:border-purple-700 dark:hover:bg-purple-950/20">
              <input
                type="radio"
                name="embedding-provider"
                value="LOCAL"
                checked={embeddingProvider === "LOCAL"}
                onChange={(e) => setEmbeddingProvider(e.target.value as EmbeddingProvider)}
                disabled={loading || saving}
                className="mt-1 h-4 w-4 shrink-0 text-purple-600 accent-purple-600 focus:outline-none focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex-1">
                <div className="font-medium text-zinc-900 dark:text-white">MxBai Embed Large</div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {isEn
                    ? "On-premise local embedding endpoint. Requires 1024-dimension chunk store."
                    : "Endpoint embedding cục bộ on-premise. Cần kho chunk dimension 1024."}
                </p>
              </div>
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (isEn ? "Saving..." : "Đang lưu...") : (isEn ? "Save Settings" : "Lưu cài đặt")}
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {isEn
                ? "Applies to this tenant configuration."
                : "Áp dụng cho cấu hình tenant hiện tại."}
            </span>
          </div>
        </div>

        {/* Section 3: Feedback Summary */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            {isEn ? "Feedback Summary" : "Tóm tắt phản hồi"}
          </h2>
          {feedbackLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            </div>
          ) : !feedback || feedback.ratedMessages === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {isEn ? "No feedback data available yet" : "Chưa có dữ liệu phản hồi"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {Math.round(feedback.helpfulPercent)}%
                  </span>
                </div>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  {isEn ? "Helpful" : "Hữu ích"}
                </p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {Math.round(feedback.notHelpfulPercent)}%
                  </span>
                </div>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {isEn ? "Not Helpful" : "Không hữu ích"}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {feedback.totalMessages}
                  </span>
                </div>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  {isEn ? "Total Messages" : "Tổng tin nhắn"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Low Rated Responses */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            {isEn ? "Low Rated Responses" : "Phản hồi đánh giá thấp"}
          </h2>
          {feedbackLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            </div>
          ) : !feedback || feedback.lowRatedResponses.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-700 dark:bg-emerald-900/30">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {isEn ? "No low-rated responses found ✅" : "Không có phản hồi đánh giá thấp ✅"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {isEn ? "Answer" : "Câu trả lời"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {isEn ? "Source Document" : "Tài liệu nguồn"}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {isEn ? "Rating" : "Đánh giá"}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {isEn ? "Date" : "Ngày"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {feedback.lowRatedResponses.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        item.rating === 1
                          ? "bg-red-50/50 dark:bg-red-950/20"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                        <div className="max-w-md truncate" title={item.answer}>
                          {item.answer.length > 80 ? `${item.answer.slice(0, 80)}...` : item.answer}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {extractDocumentName(item.sourceChunks)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {renderStars(item.rating)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {new Date(item.createdAt).toLocaleDateString(isEn ? "en-US" : "vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
}

