"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Brain,
  SlidersHorizontal,
  Send,
  Database,
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Upload,
  Bot,
  Loader2,
  Save,
  RefreshCw,
  Users,
  CheckCircle,
  XCircle,
  Heart,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface NanobotSettings {
  agent: { model: string; provider: string }
  providers: string[]
  telegram: { enabled: boolean; allowFrom: string[] }
  mcpServers: string[]
  soul: string | null
  heartbeat: string | null
  configDir: string
}

interface AgentUser {
  id: string
  name: string
  telegramId: string
  botToken: string | null
  status: string
}

export default function SettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<NanobotSettings | null>(null)
  const [agents, setAgents] = useState<AgentUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // Editable fields
  const [model, setModel] = useState("")
  const [soul, setSoul] = useState("")
  const [heartbeat, setHeartbeat] = useState("")
  const [savingField, setSavingField] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/dashboard")
    }
  }, [authLoading, isAdmin, router])

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/users").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([s, u]) => {
        if (s) {
          setSettings(s)
          setModel(s.agent.model)
          setSoul(s.soul ?? "")
          setHeartbeat(s.heartbeat ?? "")
        }
        setAgents(u ?? [])
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setIsLoading(false))
  }, [isAdmin])

  async function saveField(field: string, value: string) {
    setSavingField(field)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success(`${field} updated`)
    } catch {
      toast.error(`Failed to save ${field}`)
    } finally {
      setSavingField(null)
    }
  }

  async function handleSync() {
    setIsSyncing(true)
    try {
      const res = await fetch("/api/provisioning", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      const data = await res.json()
      toast.success(`Agent synced — ${data.usersProvisioned} users provisioned`)
    } catch {
      toast.error("Failed to sync agent. Check server logs.")
    } finally {
      setIsSyncing(false)
    }
  }

  if (authLoading || !isAdmin) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-[#4cd7f6] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Settings</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <SlidersHorizontal className="h-[18px] w-[18px] text-[#4cd7f6]" />
            Nanobot agent configuration and system management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#4cd7f6]/10 border border-[#4cd7f6]/20 text-[#4cd7f6] text-xs font-bold rounded-lg hover:bg-[#4cd7f6] hover:text-[#003640] transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Sync & Restart Agent"}
          </button>
        </div>
      </div>

      {/* LLM Configuration */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Brain className="h-5 w-5 text-[#4cd7f6]" />
          </div>
          <h3 className="text-lg font-semibold font-headline text-[#dae2fd]">LLM Configuration</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Model</label>
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1 bg-[#222a3d] border-none rounded-lg text-sm px-4 py-2.5 font-mono-tech text-[#dae2fd] focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="openai/gpt-5.4-nano"
                />
                <button
                  onClick={() => saveField("model", model)}
                  disabled={savingField === "model"}
                  className="p-2.5 bg-[#222a3d] rounded-lg text-slate-400 hover:text-[#4cd7f6] transition-colors disabled:opacity-50"
                >
                  {savingField === "model" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Provider</label>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#222a3d] rounded-lg">
                <Bot className="h-4 w-4 text-[#4cd7f6]" />
                <span className="text-sm font-medium text-[#dae2fd] capitalize">{settings?.agent.provider || "—"}</span>
              </div>
            </div>
          </div>
          <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">API Key</label>
              <div className="relative">
                <Input
                  className="w-full bg-[#222a3d] border-none rounded-lg text-sm px-4 py-2.5 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] pr-12 text-[#dae2fd] outline-none"
                  type={showApiKey ? "text" : "password"}
                  defaultValue="sk-or-v1-••••••••••••"
                  readOnly
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#dae2fd] transition-colors"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Managed via .env file on server. Not editable from dashboard.</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">MCP Servers</label>
              <div className="flex flex-wrap gap-2">
                {settings?.mcpServers.map((s) => (
                  <span key={s} className="px-2.5 py-1 bg-[#222a3d] rounded-lg text-xs font-mono text-[#4cd7f6] border border-white/5">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent List */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Users className="h-5 w-5 text-[#4cd7f6]" />
          </div>
          <h3 className="text-lg font-semibold font-headline text-[#dae2fd]">Agents</h3>
          <span className="text-xs text-slate-500 ml-auto">{agents.length} users</span>
        </div>
        <div className="bg-[#131b2e] rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Telegram ID</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bot Token</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3 text-sm text-[#dae2fd] font-medium">{agent.name}</td>
                  <td className="px-6 py-3 text-xs font-mono text-slate-400">{agent.telegramId}</td>
                  <td className="px-6 py-3">
                    {agent.botToken ? (
                      <span className="text-xs font-mono text-slate-500">{agent.botToken.slice(0, 8)}•••</span>
                    ) : (
                      <span className="text-xs text-[#ffb4ab]">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {agent.botToken ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4ae176]">
                        <CheckCircle className="h-3 w-3" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ffb4ab]">
                        <XCircle className="h-3 w-3" /> Incomplete
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">No users configured</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Send className="h-3.5 w-3.5" />
          Telegram allowFrom: {settings?.telegram.allowFrom.length ?? 0} user IDs provisioned
        </div>
      </section>

      {/* SOUL.md — Agent Personality */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
              <Bot className="h-5 w-5 text-[#4cd7f6]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-headline text-[#dae2fd]">SOUL.md</h3>
              <p className="text-[10px] text-slate-500">Agent personality, scope, and communication style</p>
            </div>
          </div>
          <button
            onClick={() => saveField("soul", soul)}
            disabled={savingField === "soul"}
            className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg text-xs text-slate-400 hover:text-[#4cd7f6] hover:border-[#4cd7f6]/30 transition-all disabled:opacity-50"
          >
            {savingField === "soul" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        <Textarea
          className="w-full bg-[#131b2e] border border-white/5 rounded-xl text-sm px-6 py-4 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] leading-relaxed text-[#dae2fd] outline-none resize-y"
          value={soul}
          onChange={(e) => setSoul(e.target.value)}
          rows={12}
        />
      </section>

      {/* HEARTBEAT.md — Monitoring Tasks */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#4ae176]/10 rounded-lg">
              <Heart className="h-5 w-5 text-[#4ae176]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-headline text-[#dae2fd]">HEARTBEAT.md</h3>
              <p className="text-[10px] text-slate-500">Periodic monitoring tasks and alert conditions</p>
            </div>
          </div>
          <button
            onClick={() => saveField("heartbeat", heartbeat)}
            disabled={savingField === "heartbeat"}
            className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg text-xs text-slate-400 hover:text-[#4cd7f6] hover:border-[#4cd7f6]/30 transition-all disabled:opacity-50"
          >
            {savingField === "heartbeat" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        <Textarea
          className="w-full bg-[#131b2e] border border-white/5 rounded-xl text-sm px-6 py-4 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] leading-relaxed text-[#dae2fd] outline-none resize-y"
          value={heartbeat}
          onChange={(e) => setHeartbeat(e.target.value)}
          rows={8}
        />
      </section>

      {/* Data Management */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Database className="h-5 w-5 text-[#4cd7f6]" />
          </div>
          <h3 className="text-lg font-semibold font-headline text-[#dae2fd]">Data Management</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button className="flex items-center gap-3 p-6 bg-[#131b2e] rounded-xl border border-white/5 hover:bg-[#222a3d] transition-all group text-left">
            <Download className="h-5 w-5 text-[#4cd7f6] shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <p className="font-bold text-[#dae2fd] text-sm">Export Config</p>
              <p className="text-[10px] text-slate-500">Download config.json backup</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-6 bg-[#131b2e] rounded-xl border border-white/5 hover:bg-[#222a3d] transition-all group text-left">
            <Upload className="h-5 w-5 text-[#4cd7f6] shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <p className="font-bold text-[#dae2fd] text-sm">Import Config</p>
              <p className="text-[10px] text-slate-500">Restore from JSON backup</p>
            </div>
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#ffb4ab]/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-[#ffb4ab]" />
          </div>
          <h3 className="text-lg font-semibold text-[#ffb4ab] font-headline">Danger Zone</h3>
        </div>
        <div className="bg-[#131b2e] p-6 rounded-xl border border-[#ffb4ab]/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-[#dae2fd] text-sm">Force Restart All Agents</h4>
              <p className="text-[10px] text-slate-500">Sync allowFrom and restart the nanobot container. Active sessions will be interrupted.</p>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-6 py-2 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs font-bold rounded-lg hover:bg-[#ffb4ab] hover:text-[#690005] transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {isSyncing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Restarting...
                </span>
              ) : (
                "Force Restart"
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Config Info */}
      <div className="text-[10px] text-slate-600 text-right">
        Config directory: <span className="font-mono">{settings?.configDir ?? "—"}</span>
      </div>
    </div>
  )
}
