"use client"

import { ChatInterface } from "@/components/chat/chat-interface"

export default function ChatPage() {
  return (
    <div className="-m-6 flex h-[calc(100vh-64px)] flex-col lg:-m-8">
      <ChatInterface />
    </div>
  )
}
