"use client"

import { useState, useEffect, useCallback } from "react"
import { formatTime } from "@/lib/formatters"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
}

const STORAGE_KEY = "mikrotik-chat-history"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function deriveTitle(msgs: ChatMessage[]): string {
  const firstUser = msgs.find((m) => m.role === "user")
  if (!firstUser) return "New Chat"
  return firstUser.content.length > 40 ? firstUser.content.slice(0, 40) + "..." : firstUser.content
}

export const WELCOME_MSG: ChatMessage = {
  role: "assistant",
  content: "System online. I'm connected to your MikroTik network and ready to assist. Ask me to check router status, manage hotspot users, audit firewall rules, or monitor traffic.",
  timestamp: formatTime(new Date()),
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null

  // Persist conversations to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  }, [conversations])

  const newConversation = useCallback((): string => {
    const conv: Conversation = {
      id: generateId(),
      title: "New Chat",
      messages: [WELCOME_MSG],
      createdAt: new Date().toISOString(),
    }
    setConversations((prev) => [conv, ...prev])
    setActiveId(conv.id)
    return conv.id
  }, [])

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    setActiveId((prev) => (prev === id ? null : prev))
  }, [])

  const updateMessages = useCallback((
    conversationId: string,
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])
  ) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c
        const newMsgs = typeof updater === "function" ? updater(c.messages) : updater
        return { ...c, messages: newMsgs, title: deriveTitle(newMsgs) }
      })
    )
  }, [])

  const renameConversation = useCallback((id: string, title: string) => {
    if (!title.trim()) return
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c))
    )
  }, [])

  return {
    conversations,
    activeId,
    activeConversation,
    newConversation,
    deleteConversation,
    setActiveId,
    updateMessages,
    renameConversation,
  }
}
