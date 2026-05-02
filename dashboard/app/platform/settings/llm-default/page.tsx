"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Bot, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

type Provider = "openrouter" | "openai" | "anthropic" | "google"
interface ModelOption { id: string; label: string; tier: string }

interface Settings {
  provider: Provider
  model: string
  apiKeyMasked: string
  hasKey: boolean
  updatedAt: string | null
  models: Record<Provider, ModelOption[]>
}

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google AI" },
]

export default function LlmDefaultPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [provider, setProvider] = useState<Provider>("openrouter")
  const [model, setModel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/platform/settings/llm").then(r => r.json()).then((d: Settings) => {
      setSettings(d)
      setProvider(d.provider)
      setModel(d.model)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = { provider, model }
      if (apiKey.trim()) body.apiKey = apiKey.trim()
      const res = await fetch("/api/platform/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("Global LLM settings saved")
        setApiKey("")
        // Refresh masked key
        const updated: Settings = await fetch("/api/platform/settings/llm").then(r => r.json())
        setSettings(updated)
      } else {
        const d = await res.json()
        toast.error(d.error ?? "Failed to save")
      }
    } finally { setSaving(false) }
  }

  const modelOptions = settings?.models[provider] ?? []

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
          <Bot className="h-7 w-7 text-[#4cd7f6]" /> Global LLM Default
        </h2>
        <p className="text-muted-foreground">Fallback LLM config used by all tenants unless they override it</p>
      </div>

      <div className="max-w-lg">
        <form onSubmit={handleSave} className="card-glass rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v as Provider); setModel("") }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue placeholder="Select model…" /></SelectTrigger>
              <SelectContent>
                {modelOptions.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span>{m.label}</span>
                    <span className={`ml-2 text-[10px] ${m.tier === "free" ? "text-[#4ae176]" : m.tier === "premium" ? "text-amber-400" : "text-[#869397]"}`}>
                      {m.tier}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Or type a custom model ID…"
              value={modelOptions.some(m => m.id === model) ? "" : model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="space-y-1.5">
            <Label>API Key</Label>
            {settings?.hasKey && (
              <p className="text-xs text-[#869397]">Current key: <span className="font-mono">{settings.apiKeyMasked}</span></p>
            )}
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={settings?.hasKey ? "Leave blank to keep existing key" : "Enter API key…"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#869397] hover:text-[#4cd7f6] transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving || !model}
            className="w-full bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Global LLM Config
          </Button>
        </form>
      </div>
    </div>
  )
}
