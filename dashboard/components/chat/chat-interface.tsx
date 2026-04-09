"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageSquare, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
      } catch (err) {
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
    <div className="flex h-full overflow-hidden rounded-lg" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 0 32px rgba(76,215,246,0.08)', border: '1px solid rgba(61, 73, 76, 0.15)' }}>
      {/* Session sidebar */}
      <div
        className={cn(
          "flex flex-col transition-all",
          showSidebar ? "w-72" : "w-0 overflow-hidden",
          "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-20",
          !showSidebar && "max-lg:hidden"
        )}
        style={showSidebar ? { borderRight: '1px solid rgba(61, 73, 76, 0.15)', background: 'rgba(35, 42, 60, 0.5)' } : undefined}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Chats</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleNewSession}
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setActiveSessionId(session.id)
                  // On mobile, close sidebar after selecting
                  if (window.innerWidth < 1024) setShowSidebar(false)
                }}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  session.id === activeSessionId
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{session.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteSession(session.id)
                  }}
                  className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                  title="Delete chat"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(61, 73, 76, 0.15)' }}>
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="hidden rounded p-1 text-muted-foreground transition-colors hover:text-foreground lg:block"
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground">
              {activeSession.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              MikroTik AI Agent
            </p>
          </div>
          <div className="flex h-2 w-2 items-center">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeSession.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Start a conversation
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask the MikroTik AI Agent anything about your network.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeSession.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border-l-2 border-primary px-4 py-3" style={{ background: 'rgba(23, 31, 51, 0.8)', backdropFilter: 'blur(20px)' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  )
}
