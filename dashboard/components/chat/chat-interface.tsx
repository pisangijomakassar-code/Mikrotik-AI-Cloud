"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageSquare, Plus, Trash2, Bot } from "lucide-react"
import { MessageBubble } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"
import { useSendMessage, useUploadImage } from "@/hooks/use-chat"
import type { ChatMessage } from "@/hooks/use-chat"
import { cn } from "@/lib/utils"

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
}

function generateId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

function createSession(): ChatSession {
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    createdAt: new Date(),
  }
}

export function ChatInterface() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [createSession()])
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id)
  const [showSidebar, setShowSidebar] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const sendMessageMutation = useSendMessage()
  const uploadImageMutation = useUploadImage()

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0]

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [activeSession.messages.length, scrollToBottom])

  const updateSession = useCallback(
    (sessionId: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updater(s) : s))
      )
    },
    []
  )

  const handleNewSession = useCallback(() => {
    const newSession = createSession()
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(newSession.id)
  }, [])

  const handleDeleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id)
        if (filtered.length === 0) {
          const fresh = createSession()
          setActiveSessionId(fresh.id)
          return [fresh]
        }
        if (activeSessionId === id) {
          setActiveSessionId(filtered[0].id)
        }
        return filtered
      })
    },
    [activeSessionId]
  )

  const handleSend = useCallback(
    async (message: string, imageFile?: File) => {
      const sessionId = activeSessionId
      let imageUrl: string | undefined
      let imageBase64: string | undefined

      // Upload image if provided
      if (imageFile) {
        try {
          imageUrl = await uploadImageMutation.mutateAsync(imageFile)
        } catch {
          // Fallback: use base64 preview
          imageUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target?.result as string)
            reader.readAsDataURL(imageFile)
          })
        }
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(imageFile)
        })
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: message,
        imageUrl,
        timestamp: new Date(),
      }

      updateSession(sessionId, (s) => {
        const updated = { ...s, messages: [...s.messages, userMsg] }
        // Set title from first message
        if (s.messages.length === 0 && message) {
          updated.title = message.slice(0, 40) + (message.length > 40 ? "..." : "")
        }
        return updated
      })

      // Send to API
      try {
        const response = await sendMessageMutation.mutateAsync({
          message,
          image: imageBase64,
        })

        const botMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.reply,
          timestamp: new Date(),
        }

        updateSession(sessionId, (s) => ({
          ...s,
          messages: [...s.messages, botMsg],
        }))
      } catch {
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: "Sorry, I could not process your request. Please try again.",
          timestamp: new Date(),
        }

        updateSession(sessionId, (s) => ({
          ...s,
          messages: [...s.messages, errorMsg],
        }))
      }
    },
    [activeSessionId, updateSession, sendMessageMutation, uploadImageMutation]
  )

  const isLoading = sendMessageMutation.isPending || uploadImageMutation.isPending

  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-white/5 bg-slate-900">
      {/* Session sidebar */}
      <div
        className={cn(
          "flex flex-col transition-all bg-slate-950 border-r border-white/10",
          showSidebar ? "w-72" : "w-0 overflow-hidden",
          "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-20",
          !showSidebar && "max-lg:hidden"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-[#dae2fd] font-headline uppercase tracking-wider">Chats</h2>
          <button
            onClick={handleNewSession}
            title="New chat"
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#4cd7f6] hover:bg-white/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0.5 p-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setActiveSessionId(session.id)
                  if (window.innerWidth < 1024) setShowSidebar(false)
                }}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  session.id === activeSessionId
                    ? "bg-[#06b6d4]/10 text-[#4cd7f6]"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate font-medium">{session.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteSession(session.id)
                  }}
                  className="hidden shrink-0 rounded-lg p-0.5 text-slate-500 hover:text-[#ffb4ab] group-hover:block"
                  title="Delete chat"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col relative bg-slate-900">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-[#4cd7f6] hover:bg-white/5"
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#dae2fd] font-headline">
              {activeSession.title}
            </h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              MikroTik AI Agent
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ae176] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ae176]" />
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 pb-32">
          {activeSession.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#06b6d4]/20 border border-[#06b6d4]/50 flex items-center justify-center">
                <Bot className="h-8 w-8 text-[#4cd7f6]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#dae2fd] font-headline">
                  Start a conversation
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ask the MikroTik AI Agent anything about your network.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeSession.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-4 max-w-3xl">
                  <div className="w-8 h-8 rounded-full bg-[#06b6d4]/20 border border-[#06b6d4]/50 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-[#4cd7f6]" />
                  </div>
                  <div
                    className="p-4 rounded-2xl rounded-tl-none border border-white/10"
                    style={{
                      background: "rgba(15, 23, 42, 0.6)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4cd7f6] [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4cd7f6] [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4cd7f6] [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input - positioned at bottom */}
        <div className="absolute bottom-0 left-0 w-full">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
