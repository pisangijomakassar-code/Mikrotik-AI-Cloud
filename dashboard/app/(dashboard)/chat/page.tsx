"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, User, Send, Paperclip, Mic, Heart, Shield, FileText, Cpu, Wifi } from "lucide-react"
import { useRouters } from "@/hooks/use-routers"
import { toast } from "sonner"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
}

function renderContent(text: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    if (line.startsWith("• ") || line.startsWith("- ")) {
      return <li key={i} className="ml-4 text-sm leading-relaxed">{inlineFormat(line.slice(2))}</li>
    }
    if (line.startsWith("```") || line.trim() === "```") return null
    return <p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>
  })
}

function inlineFormat(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="font-bold text-white">{p.slice(2, -2)}</strong>
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} className="text-[#4cd7f6] bg-slate-950/50 px-1.5 py-0.5 rounded text-xs font-mono">{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "System online. I'm connected to your MikroTik network and ready to assist. Ask me to check router status, manage hotspot users, audit firewall rules, or monitor traffic.",
    timestamp: formatTime(new Date()),
  }])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { data: routers } = useRouters()
  const defaultRouter = routers?.find(r => r.isDefault) || routers?.[0]

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function send() {
    if (!input.trim() || isLoading) return
    const userMsg: ChatMessage = { role: "user", content: input.trim(), timestamp: formatTime(new Date()) }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: userMsg.content }) })
      const data = res.ok ? await res.json() : null
      setMessages(prev => [...prev, { role: "assistant", content: data?.reply || data?.message || data?.response || "Agent is offline. Try again.", timestamp: formatTime(new Date()) }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. The AI agent may be offline.", timestamp: formatTime(new Date()) }])
    } finally { setIsLoading(false) }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] -m-8">
      {/* Chat */}
      <section className="flex-1 flex flex-col relative border-r border-white/5 bg-slate-900">
        <div className="flex-1 overflow-y-auto p-8 space-y-6 pb-32 custom-scrollbar">
          {messages.map((msg, i) => msg.role === "assistant" ? (
            <div key={i} className="flex gap-4 max-w-3xl">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none border border-white/10" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)" }}>
                <div className="space-y-1">{renderContent(msg.content)}</div>
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

        {/* Bottom input */}
        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {[
              { icon: Heart, label: "Diagnose connection", prompt: "Diagnose connection issues" },
              { icon: FileText, label: "Check logs", prompt: "Show recent system logs" },
              { icon: Cpu, label: "System health", prompt: "Check system health on all routers" },
              { icon: Shield, label: "Audit Firewall", prompt: "Audit firewall rules" },
              { icon: Wifi, label: "Hotspot users", prompt: "Show active hotspot users" },
            ].map(({ icon: Icon, label, prompt }) => (
              <button key={label} onClick={() => setInput(prompt)} className="whitespace-nowrap px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
          <div className="relative max-w-4xl mx-auto">
            <div className="flex items-center p-2 rounded-2xl shadow-2xl" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <button className="p-3 text-slate-400 hover:text-cyan-400 transition-colors"><Mic className="h-5 w-5" /></button>
              <input className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-slate-100 placeholder-slate-500 px-4" placeholder="Ask AI to configure OSPF, check routes, or monitor traffic..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }}} disabled={isLoading} />
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

      {/* Right panel */}
      <aside className="w-80 bg-slate-950/50 p-6 space-y-6 hidden lg:block overflow-y-auto">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Network Context</h3>
        {defaultRouter ? (
          <div className="p-4 rounded-xl" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400">Primary Router</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${defaultRouter.health?.status === "online" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"}`}>
                {defaultRouter.health?.status === "online" ? "Online" : "Offline"}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-100 mb-1">{defaultRouter.name}</div>
            <div className="text-[11px] font-mono text-cyan-500">{defaultRouter.host}:{defaultRouter.port}</div>
            {defaultRouter.health?.status === "online" && (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>CPU</span><span>{defaultRouter.health.cpuLoad}%</span></div>
                  <div className="h-1.5 bg-[#222a3d] rounded-full overflow-hidden"><div className="h-full bg-[#4cd7f6] rounded-full" style={{ width: `${defaultRouter.health.cpuLoad}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Memory</span><span>{defaultRouter.health.memoryPercent}%</span></div>
                  <div className="h-1.5 bg-[#222a3d] rounded-full overflow-hidden"><div className="h-full bg-[#4ae176] rounded-full" style={{ width: `${defaultRouter.health.memoryPercent}%` }} /></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Clients</span><span className="text-[#4cd7f6] font-bold">{defaultRouter.health.activeClients}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-white/10 text-center" style={{ background: "rgba(15,23,42,0.6)" }}>
            <p className="text-xs text-slate-500">No router connected</p>
          </div>
        )}
        <div>
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Session</h4>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between"><span>Messages</span><span className="text-slate-300">{messages.length}</span></div>
            <div className="flex justify-between"><span>Model</span><span className="text-cyan-400 font-mono text-[10px]">Nanobot Agent</span></div>
            <div className="flex justify-between"><span>Status</span><span className="text-emerald-400">Connected</span></div>
          </div>
        </div>
      </aside>
    </div>
  )
}
