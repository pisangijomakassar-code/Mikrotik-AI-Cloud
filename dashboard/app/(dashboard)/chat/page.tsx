"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, User, Send, Paperclip, Heart, Shield, FileText, Cpu, Wifi, Plus, MessageSquare, Trash2, Pencil, Check, X, HardDrive, Router } from "lucide-react"
import { useRouters } from "@/hooks/use-routers"
import { useChatHistory, WELCOME_MSG } from "@/hooks/use-chat-history"
import type { ChatMessage } from "@/hooks/use-chat-history"
import { apiClient } from "@/lib/api-client"
import { formatTime } from "@/lib/formatters"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default function ChatPage() {
  const {
    conversations,
    activeId,
    activeConversation,
    newConversation,
    deleteConversation,
    setActiveId,
    updateMessages,
    renameConversation,
  } = useChatHistory()

  const messages = activeConversation?.messages ?? [WELCOME_MSG]

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { data: routers } = useRouters()
  const defaultRouter = routers?.find(r => r.isDefault) || routers?.[0]

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  function startRename(id: string, currentTitle: string) {
    setEditingConvId(id)
    setEditingTitle(currentTitle)
  }

  function saveRename() {
    if (!editingConvId || !editingTitle.trim()) return
    renameConversation(editingConvId, editingTitle)
    setEditingConvId(null)
  }

  async function send() {
    if (!input.trim() || isLoading) return

    // Auto-create conversation if none active
    let currentId = activeId
    if (!currentId) {
      currentId = newConversation()
    }

    const userMsg: ChatMessage = { role: "user", content: input.trim(), timestamp: formatTime(new Date()) }
    const currentMsgs = conversations.find((c) => c.id === currentId)?.messages ?? [WELCOME_MSG]
    const updatedMessages = [...currentMsgs, userMsg]

    // Update messages in the active conversation
    updateMessages(currentId, updatedMessages)
    setInput("")
    setIsLoading(true)
    try {
      // Send full conversation history for context awareness
      const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }))
      const data = await apiClient.post<Record<string, string>>("/api/chat", { message: userMsg.content, history, conversationId: currentId })
      const assistantMsg: ChatMessage = { role: "assistant", content: data?.reply || data?.message || data?.response || "Agent is offline. Try again.", timestamp: formatTime(new Date()) }
      updateMessages(currentId, (prev) => [...prev, assistantMsg])
    } catch {
      const errMsg: ChatMessage = { role: "assistant", content: "Connection error. The AI agent may be offline.", timestamp: formatTime(new Date()) }
      updateMessages(currentId, (prev) => [...prev, errMsg])
    } finally { setIsLoading(false) }
  }

  return (
    <div className="fixed top-16 left-0 md:left-64 right-0 bottom-0 flex flex-col md:flex-row">
      {/* Chat */}
      <section className="flex-1 flex flex-col border-r border-border/20 bg-slate-900 overflow-hidden">
        {/* Scrollable chat history only */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
          {messages.map((msg, i) => msg.role === "assistant" ? (
            <div key={i} className="flex gap-4 max-w-3xl">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none border border-white/10" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)" }}>
                <div className="prose prose-invert prose-sm max-w-none
                  prose-p:text-slate-200 prose-p:leading-relaxed prose-p:my-1
                  prose-headings:text-foreground prose-headings:font-bold
                  prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                  prose-strong:text-white
                  prose-code:text-primary prose-code:bg-slate-950/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                  prose-pre:bg-background prose-pre:border prose-pre:border-border/20 prose-pre:rounded-xl prose-pre:my-2
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-li:text-slate-200 prose-li:my-0
                  prose-ul:my-1 prose-ol:my-1
                  prose-table:text-xs
                  prose-th:text-foreground prose-th:px-3 prose-th:py-1.5 prose-th:bg-surface-lowest/80 prose-th:text-left
                  prose-td:px-3 prose-td:py-1.5 prose-td:border-t prose-td:border-border/20
                  prose-blockquote:border-l-[#4cd7f6] prose-blockquote:text-slate-300
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 block font-mono">{msg.timestamp}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-4 max-w-3xl ml-auto flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-slate-400" />
              </div>
              <div className="bg-cyan-600/20 border border-cyan-500/30 p-4 rounded-2xl rounded-tr-none text-slate-100">
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <span className="text-[10px] text-cyan-500/60 mt-2 block font-mono text-right">{msg.timestamp}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-3xl">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-cyan-400 animate-pulse" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none border border-white/10" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)" }}>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Fixed bottom input - not scrollable */}
        <div className="shrink-0 p-3 md:p-6 border-t border-border/20 bg-slate-900">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {[
              { icon: Heart, label: "Diagnose connection", prompt: "Diagnose connection issues" },
              { icon: FileText, label: "Check logs", prompt: "Show recent system logs" },
              { icon: Cpu, label: "System health", prompt: "Check system health on all routers" },
              { icon: Shield, label: "Audit Firewall", prompt: "Audit firewall rules" },
              { icon: Wifi, label: "Hotspot users", prompt: "Show active hotspot users" },
            ].map(({ icon: Icon, label, prompt }) => (
              <button key={label} onClick={() => setInput(prompt)} className="whitespace-nowrap px-4 py-2 rounded-full border border-white/10 bg-muted/30 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
          <div className="relative max-w-4xl mx-auto">
            <div className="flex items-center p-2 rounded-2xl shadow-2xl" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <Input className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-slate-100 placeholder-slate-500 px-4 pl-5 shadow-none" placeholder="Ask AI to configure OSPF, check routes, or monitor traffic..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }}} disabled={isLoading} />
              <div className="flex items-center gap-2 pr-2">
                <label className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
                  <Paperclip className="h-5 w-5" />
                  <input type="file" accept="image/*" className="hidden" onChange={() => toast.info("Image upload coming soon")} />
                </label>
                <button onClick={send} disabled={isLoading || !input.trim()} className="bg-cyan-500 text-slate-950 p-3 rounded-xl hover:bg-cyan-400 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Right panel — Conversation History */}
      <aside className="w-72 bg-slate-950/50 hidden lg:flex flex-col overflow-hidden border-l border-border/20">
        <div className="p-4 border-b border-border/20">
          <button
            onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-low border border-border/20 text-xs font-bold text-primary hover:bg-muted transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
              <MessageSquare className="h-8 w-8 text-slate-700" />
              <p className="text-xs text-slate-500">No conversations yet</p>
              <p className="text-[10px] text-slate-600">Start a new chat to begin</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group/conv flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors relative",
                  activeId === conv.id
                    ? "bg-muted text-primary"
                    : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-300"
                )}
                onClick={() => setActiveId(conv.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                {editingConvId === conv.id ? (
                  <div className="flex-1 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="flex-1 bg-surface-low border border-white/10 rounded px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditingConvId(null) }}
                      autoFocus
                    />
                    <button onClick={saveRename} className="p-0.5 text-tertiary">
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={() => setEditingConvId(null)} className="p-0.5 text-slate-500 hover:text-slate-300">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{conv.title}</p>
                      <p className="text-[10px] text-slate-600">{conv.messages.length - 1} messages</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/conv:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); startRename(conv.id, conv.title) }}
                        className="p-1 text-slate-500 hover:text-primary transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                        className="p-1 text-slate-500 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Router status with CPU & Memory */}
        {defaultRouter && (
          <div className="shrink-0 p-3 border-t border-border/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Router className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">{defaultRouter.name}</span>
              </div>
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded",
                defaultRouter.health?.status === "online"
                  ? "bg-tertiary/10 text-tertiary"
                  : "bg-destructive/10 text-destructive"
              )}>
                {defaultRouter.health?.status === "online" ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            {defaultRouter.health?.status === "online" && (
              <div className="space-y-1.5">
                <div>
                  <div className="flex items-center justify-between text-[9px] mb-0.5">
                    <span className="text-slate-500 flex items-center gap-1"><Cpu className="h-2.5 w-2.5" />CPU</span>
                    <span className="font-mono text-slate-400">{defaultRouter.health.cpuLoad}%</span>
                  </div>
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", defaultRouter.health.cpuLoad > 80 ? "bg-destructive" : defaultRouter.health.cpuLoad > 50 ? "bg-amber-400" : "bg-primary")}
                      style={{ width: `${defaultRouter.health.cpuLoad}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[9px] mb-0.5">
                    <span className="text-slate-500 flex items-center gap-1"><HardDrive className="h-2.5 w-2.5" />MEM</span>
                    <span className="font-mono text-slate-400">{defaultRouter.health.memoryPercent}%</span>
                  </div>
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", defaultRouter.health.memoryPercent > 80 ? "bg-destructive" : defaultRouter.health.memoryPercent > 50 ? "bg-amber-400" : "bg-tertiary")}
                      style={{ width: `${defaultRouter.health.memoryPercent}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-slate-500 flex items-center gap-1"><Wifi className="h-2.5 w-2.5" />Clients</span>
                  <span className="font-mono text-primary font-bold">{defaultRouter.health.activeClients}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
