"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatbotEntryLoading } from "@/components/chat/ChatbotEntryLoading";

export default function ChatbotPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/chatbot-new");
  }, [router]);

  return <ChatbotEntryLoading variant="fullscreen" />;
}
