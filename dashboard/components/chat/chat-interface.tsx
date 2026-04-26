"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageSquare, Plus, Trash2, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"
import { NetworkContextPanel } from "@/components/chat/network-context-panel"
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

      if (imageFile) {
        try {
          imageUrl = await uploadImageMutation.mutateAsync(imageFile)
        } catch {
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

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: message,
        imageUrl,
        timestamp: new Date(),
      }

      updateSession(sessionId, (s) => {
        const updated = { ...s, messages: [...s.messages, userMsg] }
        if (s.messages.length === 0 && message) {
          updated.title = message.slice(0, 40) + (message.length > 40 ? "..." : "")
        }
        return updated
      })

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
    <div className="flex h-full overflow-hidden bg-background">
      {/* Session sidebar */}
      <div
        className={cn(
          "flex flex-col border-r border-border bg-background transition-all",
          showSidebar ? "w-72" : "w-0 overflow-hidden",
          "max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-20",
          !showSidebar && "max-lg:hidden"
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="font-headline text-sm font-bold uppercase tracking-wider text-foreground">
            Chats
          </h2>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleNewSession}
            title="New chat"
            className="rounded-lg text-muted-foreground hover:text-primary"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
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
                    ? "border-r-2 border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
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
                  className="hidden shrink-0 rounded-lg p-0.5 text-muted-foreground/70 hover:text-red-400 group-hover:block"
                  title="Delete chat"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area (center) - flex-1 */}
      <section className="relative flex flex-1 flex-col border-r border-border bg-background">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-md">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded-lg text-muted-foreground hover:text-primary"
            title={showSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h3 className="font-headline text-sm font-bold text-foreground">
              {activeSession.title}
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              MikroTik AI Agent
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/70">
              Online
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 pb-32">
          {activeSession.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/50 bg-primary/20">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-headline text-sm font-bold text-foreground">
                  Start a conversation
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
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
                <div className="flex max-w-3xl gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/20">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="card-glass rounded-2xl rounded-tl-none border border-border p-4">
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

        {/* Input - positioned at bottom */}
        <div className="absolute bottom-0 left-0 w-full">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </section>

      {/* Right Panel - Network Context */}
      <NetworkContextPanel />
    </div>
  )
}
