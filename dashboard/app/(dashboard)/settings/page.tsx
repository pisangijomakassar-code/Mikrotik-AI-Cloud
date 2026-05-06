"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import {
  SlidersHorizontal,
  Download,
  Upload,
  Bot,
  Loader2,
  Save,
  RefreshCw,
  Database,
  AlertTriangle,
  Heart,
  Power,
  PowerOff,
  ExternalLink,
  Cpu,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import {
  useNanobotSettings,
  useSaveSettingsField,
  useSyncAgent,
  useAgentStatus,
  useToggleAgent,
} from "@/hooks/use-settings"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"

interface SettingsFormValues {
  soul: string
  heartbeat: string
}

export default function SettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const { data: settings, isLoading: settingsLoading } = useNanobotSettings()
  const saveField = useSaveSettingsField()
  const syncAgent = useSyncAgent()
  const { data: agentStatus } = useAgentStatus()
  const toggleAgent = useToggleAgent()

  const { register, reset, getValues } = useForm<SettingsFormValues>({
    defaultValues: { soul: "", heartbeat: "" },
  })

  // Reset form values when settings load
  useEffect(() => {
    if (settings) {
      reset({
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

  function handleToggleAgent() {
    const action = agentStatus?.running ? "stop" : "start"
    toggleAgent.mutate(action, {
      onSuccess: () => toast.success(action === "stop" ? "Agent dinonaktifkan" : "Agent diaktifkan"),
      onError: () => toast.error("Gagal mengubah status agent"),
    })
  }

  if (authLoading || !isAdmin) return null

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Settings</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-[18px] w-[18px] text-primary shrink-0" />
            Nanobot agent configuration and system management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleAgent}
            disabled={toggleAgent.isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 border text-xs font-bold rounded-lg transition-all disabled:opacity-50",
              agentStatus?.running
                ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive hover:text-white"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white"
            )}
          >
            {toggleAgent.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : agentStatus?.running ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
            {toggleAgent.isPending
              ? "Memproses..."
              : agentStatus?.running
              ? "Nonaktifkan Agent"
              : "Aktifkan Agent"}
          </button>
          <button
            onClick={handleSync}
            disabled={syncAgent.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#4cd7f6]/10 border border-[#4cd7f6]/20 text-primary text-xs font-bold rounded-lg hover:bg-[#4cd7f6] hover:text-primary-foreground transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", syncAgent.isPending && "animate-spin")} />
            {syncAgent.isPending ? "Syncing..." : "Sync & Restart Agent"}
          </button>
        </div>
      </div>

      {/* LLM Provider \u2014 link ke /settings/llm */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold font-headline text-foreground">LLM Provider</h3>
        </div>
        <Link
          href="/settings/llm"
          className="flex items-center justify-between p-5 bg-surface-low rounded-xl border border-border/20 hover:border-[#4cd7f6]/40 hover:bg-muted transition-all group"
        >
          <div className="flex items-center gap-4">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {settings?.agent.provider ? (
                  <span className="capitalize">{settings.agent.provider}</span>
                ) : "Belum dikonfigurasi"}
                {settings?.agent.model && (
                  <span className="ml-2 text-[10px] font-mono text-slate-500 font-normal">{settings.agent.model}</span>
                )}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Atur API key, provider, dan model AI di halaman LLM Provider</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-primary transition-colors shrink-0" />
        </Link>
      </section>

      {/* SOUL.md -- Agent Personality */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-headline text-foreground">SOUL.md</h3>
              <p className="text-[10px] text-slate-500">Agent personality, scope, and communication style</p>
            </div>
          </div>
          <button
            onClick={() => onSaveField("soul")}
            disabled={saveField.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-surface-low border border-border/20 rounded-lg text-xs text-slate-400 hover:text-primary hover:border-[#4cd7f6]/30 transition-all disabled:opacity-50"
          >
            {saveField.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        <Textarea
          className="w-full bg-surface-low border border-border/20 rounded-xl text-sm px-6 py-4 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] leading-relaxed text-foreground outline-none resize-y"
          rows={12}
          {...register("soul")}
        />
      </section>

      {/* HEARTBEAT.md -- Monitoring Tasks */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#4ae176]/10 rounded-lg">
              <Heart className="h-5 w-5 text-tertiary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-headline text-foreground">HEARTBEAT.md</h3>
              <p className="text-[10px] text-slate-500">Periodic monitoring tasks and alert conditions</p>
            </div>
          </div>
          <button
            onClick={() => onSaveField("heartbeat")}
            disabled={saveField.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-surface-low border border-border/20 rounded-lg text-xs text-slate-400 hover:text-primary hover:border-[#4cd7f6]/30 transition-all disabled:opacity-50"
          >
            {saveField.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
        <Textarea
          className="w-full bg-surface-low border border-border/20 rounded-xl text-sm px-6 py-4 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] leading-relaxed text-foreground outline-none resize-y"
          rows={8}
          {...register("heartbeat")}
        />
      </section>

      {/* Data Management */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold font-headline text-foreground">Data Management</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button className="flex items-center gap-3 p-6 bg-surface-low rounded-xl border border-border/20 hover:bg-muted transition-all group text-left">
            <Download className="h-5 w-5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <p className="font-bold text-foreground text-sm">Export Config</p>
              <p className="text-[10px] text-slate-500">Download config.json backup</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-6 bg-surface-low rounded-xl border border-border/20 hover:bg-muted transition-all group text-left">
            <Upload className="h-5 w-5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
            <div>
              <p className="font-bold text-foreground text-sm">Import Config</p>
              <p className="text-[10px] text-slate-500">Restore from JSON backup</p>
            </div>
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#ffb4ab]/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-destructive font-headline">Danger Zone</h3>
        </div>
        <div className="bg-surface-low p-6 rounded-xl border border-[#ffb4ab]/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-foreground text-sm">Force Restart All Agents</h4>
              <p className="text-[10px] text-slate-500">Sync allowFrom and restart the nanobot container. Active sessions will be interrupted.</p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncAgent.isPending}
              className="px-6 py-2 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-destructive text-xs font-bold rounded-lg hover:bg-[#ffb4ab] hover:text-[#690005] transition-all disabled:opacity-50 whitespace-nowrap"
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
