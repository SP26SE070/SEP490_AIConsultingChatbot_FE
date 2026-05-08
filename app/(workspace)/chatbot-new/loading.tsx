import { ChatbotEntryLoading } from "@/components/chat/ChatbotEntryLoading";

export default function ChatbotNewLoading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChatbotEntryLoading variant="embedded" />
    </div>
  );
}
