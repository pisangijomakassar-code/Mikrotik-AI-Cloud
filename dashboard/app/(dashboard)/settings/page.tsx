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
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"

export default function SettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/dashboard")
    }
  }, [authLoading, isAdmin, router])

  async function handleSync() {
    setIsSyncing(true)
    try {
      const res = await fetch("/api/provisioning", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      toast.success("Agent synced and restarted successfully")
    } catch {
      toast.error("Failed to sync agent. Check server logs.")
    } finally {
      setIsSyncing(false)
    }
  }

  if (authLoading || !isAdmin) return null

  return (
    <div className="space-y-12">
      {/* Header */}
      <header className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight text-[#dae2fd] font-headline">Settings</h2>
        <p className="text-slate-400 mt-2 font-medium">Configure your AI Agent&apos;s cognitive core and operational parameters.</p>
      </header>

      {/* Section: LLM Configuration */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Brain className="h-5 w-5 text-[#4cd7f6]" />
          </div>
          <h3 className="text-xl font-semibold font-headline text-[#dae2fd]">LLM Configuration</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Model Architecture</label>
              <select className="w-full bg-[#2d3449] border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-[#4cd7f6] text-[#dae2fd] outline-none">
                <option>GPT-4o (Omni)</option>
                <option>GPT-4 Turbo</option>
                <option>Claude 3.5 Sonnet</option>
                <option>Llama 3 70B</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Provider Gateway</label>
              <div className="flex items-center gap-2 p-3 bg-[#2d3449] rounded-lg">
                <Bot className="h-4 w-4 text-[#4cd7f6]" />
                <span className="text-sm font-medium text-[#dae2fd]">OpenRouter</span>
              </div>
            </div>
          </div>
          <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 flex flex-col justify-between">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">API Key</label>
              <div className="relative">
                <input
                  className="w-full bg-[#2d3449] border-none rounded-lg text-sm p-3 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] pr-12 text-[#dae2fd] outline-none"
                  type={showApiKey ? "text" : "password"}
                  defaultValue="sk-or-v1-847293847293847293847293"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#dae2fd]"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-4">
              API keys are encrypted at rest using AES-256-GCM. Never share your secret key with anyone.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Default Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <SlidersHorizontal className="h-5 w-5 text-[#4cd7f6]" />
          </div>
          <h3 className="text-xl font-semibold font-headline text-[#dae2fd]">Default Settings</h3>
        </div>
        <div className="bg-[#131b2e] p-8 rounded-xl border border-white/5 space-y-8">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">System Instruction (Master Prompt)</label>
            <textarea
              className="w-full bg-[#2d3449] border-none rounded-lg text-sm p-4 font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] leading-relaxed text-[#dae2fd] outline-none resize-none"
              placeholder="You are a MikroTik certified network engineer AI assistant..."
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Interface Language</label>
              <select className="w-full bg-[#2d3449] border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-[#4cd7f6] text-[#dae2fd] outline-none">
                <option>English (United States)</option>
                <option>Indonesian (Bahasa Indonesia)</option>
                <option>German (Deutsch)</option>
                <option>Spanish (Espanol)</option>
              </select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Max Response Length</label>
                <span className="text-xs font-mono-tech text-[#4cd7f6]">2,048 Tokens</span>
              </div>
              <input
                className="w-full accent-[#4cd7f6] bg-[#2d3449] rounded-lg h-2"
                max={4096}
                min={128}
                step={128}
                type="range"
                defaultValue={2048}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section: Telegram Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Send className="h-5 w-5 text-[#4cd7f6]" />
          </div>
          <h3 className="text-xl font-semibold font-headline text-[#dae2fd]">Telegram Settings</h3>
        </div>
        <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-[#dae2fd]">Global Bot Defaults</p>
              <p className="text-xs text-slate-500">Manage the shared configuration for all active Telegram bots.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-[#dae2fd] transition-colors rounded-lg">View Documentation</button>
            <button className="px-6 py-2 bg-[#4cd7f6]/10 border border-[#4cd7f6]/20 text-[#4cd7f6] text-xs font-bold rounded-lg hover:bg-[#4cd7f6] hover:text-[#003640] transition-all">
              Configure Bots
            </button>
          </div>
        </div>
      </section>

      {/* Section: Data Management */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
            <Database className="h-5 w-5 text-[#4cd7f6]" />
          </div>
          <h3 className="text-xl font-semibold font-headline text-[#dae2fd]">Data Management</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button className="flex items-center justify-center gap-3 p-8 bg-[#131b2e] rounded-xl border border-white/5 hover:bg-[#222a3d] transition-all group">
            <Download className="h-5 w-5 text-[#4cd7f6] group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="font-bold text-[#dae2fd]">Export User Data (JSON)</p>
              <p className="text-[10px] text-slate-500">Download a full backup of all configurations.</p>
            </div>
          </button>
          <button className="flex items-center justify-center gap-3 p-8 bg-[#131b2e] rounded-xl border border-white/5 hover:bg-[#222a3d] transition-all group">
            <Upload className="h-5 w-5 text-[#4cd7f6] group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="font-bold text-[#dae2fd]">Import Data</p>
              <p className="text-[10px] text-slate-500">Restore agent states from a valid JSON file.</p>
            </div>
          </button>
        </div>
      </section>

      {/* Section: Danger Zone */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#ffb4ab]/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-[#ffb4ab]" />
          </div>
          <h3 className="text-xl font-semibold text-[#ffb4ab] font-headline">Danger Zone</h3>
        </div>
        <div className="bg-[#131b2e] p-8 rounded-xl border border-[#ffb4ab]/30 ring-1 ring-[#ffb4ab]/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="font-bold text-[#dae2fd]">Destructive Actions</h4>
              <p className="text-xs text-slate-500">These actions cannot be undone. Please proceed with extreme caution.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                className="px-6 py-2 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs font-bold rounded-lg hover:bg-[#ffb4ab] hover:text-[#690005] transition-all"
                onClick={() => {
                  if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
                    toast.info("Reset not yet implemented")
                  }
                }}
              >
                Reset All Data
              </button>
              <button
                className="px-6 py-2 bg-[#93000a]/20 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs font-bold rounded-lg hover:brightness-125 transition-all"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Restarting...
                  </span>
                ) : (
                  "Force Restart All Agents"
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Action */}
      <div className="pt-12 flex justify-end gap-4 border-t border-white/5">
        <button className="px-8 py-3 text-sm font-bold text-slate-400 hover:text-[#dae2fd] transition-colors rounded-lg">
          Discard Changes
        </button>
        <button className="px-10 py-3 bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] text-sm font-bold rounded-lg shadow-lg shadow-[#4cd7f6]/20 hover:scale-[1.02] active:scale-95 transition-all">
          Save Changes
        </button>
      </div>
    </div>
  )
}
