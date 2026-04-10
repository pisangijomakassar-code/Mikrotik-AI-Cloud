"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import {
  Brain,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Download,
  Upload,
  Bot,
  Loader2,
  Save,
  RefreshCw,
  Database,
  AlertTriangle,
  Heart,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import {
  useNanobotSettings,
  useAgentUsers,
  useSaveSettingsField,
  useSyncAgent,
} from "@/hooks/use-settings"
import { AgentList } from "@/components/settings/agent-list"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface SettingsFormValues {
  model: string
  soul: string
  heartbeat: string
}

export default function SettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [showApiKey, setShowApiKey] = useState(false)

  const { data: settings, isLoading: settingsLoading } = useNanobotSettings()
  const { data: agents = [], isLoading: agentsLoading } = useAgentUsers()
  const saveField = useSaveSettingsField()
  const syncAgent = useSyncAgent()

  const { register, handleSubmit, reset, getValues } = useForm<SettingsFormValues>({
    defaultValues: { model: "", soul: "", heartbeat: "" },
  })

  // Reset form values when settings load
  useEffect(() => {
    if (settings) {
      reset({
        model: settings.agent.model,
        soul: settings.soul ?? "",
        heartbeat: settings.heartbeat ?? "",
      })
    }
  }, [settings, reset])

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/dashboard")
    }
  }, [authLoading, isAdmin, router])

  function onSaveField(field: keyof SettingsFormValues) {
    const value = getValues(field)
    saveField.mutate(
      { field, value },
      {
        onSuccess: () => toast.success(`${field} updated`),
        onError: () => toast.error(`Failed to save ${field}`),
      }
    )
  }

  function handleSync() {
    syncAgent.mutate(undefined, {
      onSuccess: (data) =>
        toast.success(`Agent synced — ${data.usersProvisioned} users provisioned`),
      onError: () => toast.error("Failed to sync agent. Check server logs."),
    })
  }

  if (authLoading || !isAdmin) return null

  if (settingsLoading) {
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
            <SlidersHorizontal className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Nanobot agent configuration and system management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncAgent.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#4cd7f6]/10 border border-[#4cd7f6]/20 text-[#4cd7f6] text-xs font-bold rounded-lg hover:bg-[#4cd7f6] hover:text-[#003640] transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", syncAgent.isPending && "animate-spin")} />
            {syncAgent.isPending ? "Syncing..." : "Sync & Restart Agent"}
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
                  placeholder="openai/gpt-5.4-nano"
                  {...register("model")}
                />
                <button
                  onClick={() => onSaveField("model")}
                  disabled={saveField.isPending}
                  className="p-2.5 bg-[#222a3d] rounded-lg text-slate-400 hover:text-[#4cd7f6] transition-colors disabled:opacity-50"
                >
                  {saveField.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Provider</label>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#222a3d] rounded-lg">
                <Bot className="h-4 w-4 text-[#4cd7f6]" />
                <span className="text-sm font-medium text-[#dae2fd] capitalize">{settings?.agent.provider || "\u2014"}</span>
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
                  defaultValue="sk-or-v1-\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
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
      <AgentList
        agents={agents}
        isLoading={agentsLoading}
        telegramAllowFromCount={settings?.telegram.allowFrom.length ?? 0}
      />

      {/* SOUL.md -- Agent Personality */}
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
            onClick={() => onSaveField("soul")}
            disabled={saveField.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg text-xs text-slate-400 hover:text-[#4cd7f6] hover:border-[#4cd7f6]/30 transition-all disabled:opacity-50"
          >
            {saveField.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        <Textarea
          className="w-full bg-[#131b2e] border border-white/5 rounded-xl text-sm px-6 py-4 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] leading-relaxed text-[#dae2fd] outline-none resize-y"
          rows={12}
          {...register("soul")}
        />
      </section>

      {/* HEARTBEAT.md -- Monitoring Tasks */}
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
            onClick={() => onSaveField("heartbeat")}
            disabled={saveField.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg text-xs text-slate-400 hover:text-[#4cd7f6] hover:border-[#4cd7f6]/30 transition-all disabled:opacity-50"
          >
            {saveField.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        <Textarea
          className="w-full bg-[#131b2e] border border-white/5 rounded-xl text-sm px-6 py-4 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] leading-relaxed text-[#dae2fd] outline-none resize-y"
          rows={8}
          {...register("heartbeat")}
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
              disabled={syncAgent.isPending}
              className="px-6 py-2 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs font-bold rounded-lg hover:bg-[#ffb4ab] hover:text-[#690005] transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {syncAgent.isPending ? (
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
        Config directory: <span className="font-mono">{settings?.configDir ?? "\u2014"}</span>
      </div>
    </div>
  )
}
