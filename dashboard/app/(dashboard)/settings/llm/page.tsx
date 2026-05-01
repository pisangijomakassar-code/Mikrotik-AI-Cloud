"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Bot, Key, RefreshCw, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Save, Activity } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Provider = "openrouter" | "openai" | "anthropic" | "google"

interface ModelInfo { id: string; label: string; tier: "free" | "cheap" | "premium" }
interface SettingsResponse {
  provider: Provider
  model: string
  apiKeyMasked: string
  hasKey: boolean
  updatedAt: string | null
  models: Record<Provider, ModelInfo[]>
}

interface UsageResponse {
  today: { tokensIn: number; tokensOut: number; total: number; calls: number }
  month: { tokensIn: number; tokensOut: number; total: number; calls: number }
  daily: { date: string; in: number; out: number; calls: number; total: number }[]
  isGlobal: boolean
}

const PROVIDER_LABEL: Record<Provider, string> = {
  openrouter: "OpenRouter (multi-model)",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI Studio",
}

const PROVIDER_HINT: Record<Provider, string> = {
  openrouter: "Get key: openrouter.ai/keys (sk-or-v1-...)",
  openai:     "Get key: platform.openai.com/api-keys (sk-...)",
  anthropic:  "Get key: console.anthropic.com/settings/keys (sk-ant-api03-...)",
  google:     "Get key: aistudio.google.com/app/apikey (AIza...)",
}

export default function LlmSettingsPage() {
  const qc = useQueryClient()
  const settings = useQuery<SettingsResponse>({
    queryKey: ["llm-settings"],
    queryFn: () => apiClient.get<SettingsResponse>("/api/settings/llm"),
  })
  const usage = useQuery<UsageResponse>({
    queryKey: ["llm-usage"],
    queryFn: () => apiClient.get<UsageResponse>("/api/settings/llm/usage"),
    refetchInterval: 30_000,
  })

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [provider, setProvider] = useState<Provider>("openrouter")
  const [model, setModel] = useState("")
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  // Sync local state dengan loaded settings
  useEffect(() => {
    if (settings.data) {
      setProvider(settings.data.provider)
      setModel(settings.data.model)
    }
  }, [settings.data])

  // Auto-detect provider dari key prefix saat user paste
  useEffect(() => {
    if (!apiKey) return
    const k = apiKey.trim()
    if (k.startsWith("sk-or-")) setProvider("openrouter")
    else if (k.startsWith("sk-ant-")) setProvider("anthropic")
    else if (k.startsWith("AIza")) setProvider("google")
    else if (k.startsWith("sk-")) setProvider("openai")
  }, [apiKey])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: { provider: Provider; model: string; apiKey?: string } = { provider, model }
      if (apiKey) body.apiKey = apiKey
      return apiClient.put<{ ok: boolean }>("/api/settings/llm", body)
    },
    onSuccess: () => {
      toast.success("Pengaturan LLM disimpan. Agent reload dalam ~3 detik.")
      setApiKey("")
      qc.invalidateQueries({ queryKey: ["llm-settings"] })
    },
    onError: (e: Error) => toast.error(e.message || "Gagal simpan"),
  })

  async function handleTest() {
    if (!apiKey) {
      toast.error("Paste API key dulu untuk test")
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const r = await apiClient.post<{ ok: boolean; provider: Provider; error?: string }>(
        "/api/settings/llm/test",
        { apiKey, provider },
      )
      setTestResult(r)
      if (r.ok) toast.success("Key valid! Provider: " + r.provider)
      else toast.error("Key invalid: " + (r.error ?? "unknown"))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setTestResult({ ok: false, error: msg })
      toast.error(msg)
    } finally {
      setTesting(false)
    }
  }

  // Fetch live model list dari OpenRouter (kalau provider = openrouter).
  const liveModels = useQuery<{ models: ModelInfo[]; counts?: { total: number; free: number; cheap: number; premium: number } }>({
    queryKey: ["llm-models-live", provider],
    queryFn: () => apiClient.get(`/api/settings/llm/models?provider=${provider}`),
    enabled: provider === "openrouter",
    staleTime: 5 * 60 * 1000,
  })

  const [showFreeOnly, setShowFreeOnly] = useState(false)
  const popularModels = settings.data?.models?.[provider] ?? []
  const allModels = liveModels.data?.models?.length ? liveModels.data.models : popularModels
  const availableModels = showFreeOnly ? allModels.filter((m) => m.tier === "free") : allModels
  const maxDaily = Math.max(...(usage.data?.daily.map((d) => d.total) ?? [1]), 1)

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-headline font-bold text-foreground">LLM Provider Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground/70">
          Atur API key + model untuk AI Assistant. Berlaku global untuk semua user.
        </p>
      </div>

      {/* Current settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-glass rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-tertiary" />
            <h3 className="text-sm font-bold text-foreground">Provider & Key</h3>
          </div>

          {settings.isLoading ? (
            <div className="space-y-3">
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Provider</label>
                <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROVIDER_LABEL) as Provider[]).map((p) => (
                      <SelectItem key={p} value={p}>{PROVIDER_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{PROVIDER_HINT[provider]}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  API Key {settings.data?.hasKey && <span className="text-tertiary">(saat ini: {settings.data.apiKeyMasked})</span>}
                </label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={settings.data?.hasKey ? "Kosong = tidak diubah" : "Paste API key..."}
                    className="pr-20 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Provider auto-detect dari prefix key.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    Model
                    {liveModels.data?.counts && (
                      <span className="ml-2 text-[10px] text-muted-foreground/70">
                        ({liveModels.data.counts.total} total · {liveModels.data.counts.free} free)
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showFreeOnly}
                        onChange={(e) => setShowFreeOnly(e.target.checked)}
                        className="h-3 w-3"
                      />
                      Free only
                    </label>
                    {provider === "openrouter" && (
                      <button
                        type="button"
                        onClick={() => liveModels.refetch()}
                        className="text-[10px] text-tertiary hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className={cn("h-3 w-3", liveModels.isFetching && "animate-spin")} />
                        Refresh
                      </button>
                    )}
                  </div>
                </div>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger><SelectValue placeholder="Pilih model..." /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {availableModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          {m.label}
                          <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold",
                            m.tier === "free" && "bg-tertiary/10 text-tertiary",
                            m.tier === "cheap" && "bg-blue-400/10 text-blue-400",
                            m.tier === "premium" && "bg-orange-400/10 text-orange-400",
                          )}>{m.tier}</span>
                        </span>
                      </SelectItem>
                    ))}
                    {/* Allow custom model */}
                    {model && !availableModels.find((m) => m.id === model) && (
                      <SelectItem value={model}>{model} (custom)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="atau ketik model ID custom..."
                  className="mt-1 font-mono text-xs"
                />
              </div>

              {testResult && (
                <div className={cn("p-2 rounded text-xs flex items-center gap-2",
                  testResult.ok ? "bg-tertiary/10 text-tertiary" : "bg-destructive/10 text-destructive"
                )}>
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testResult.ok ? "Key valid" : `Invalid: ${testResult.error}`}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={testing || !apiKey}
                  className="flex-1 px-4 py-2 rounded-lg bg-card border border-border hover:bg-white/5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Test Key
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !model}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save & Reload
                </button>
              </div>

              {settings.data?.updatedAt && (
                <p className="text-[10px] text-muted-foreground/50 text-right">
                  Last updated: {new Date(settings.data.updatedAt).toLocaleString("id-ID")}
                </p>
              )}
            </>
          )}
        </div>

        {/* Usage */}
        <div className="card-glass rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-tertiary" />
              <h3 className="text-sm font-bold text-foreground">Token Usage {usage.data?.isGlobal && <span className="text-[10px] text-muted-foreground">(global)</span>}</h3>
            </div>
            <button onClick={() => usage.refetch()} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={cn("h-3.5 w-3.5", usage.isFetching && "animate-spin")} />
            </button>
          </div>

          {usage.isLoading ? (
            <div className="h-32 bg-muted rounded animate-pulse" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <UsageStatCard label="Hari Ini" total={usage.data?.today.total ?? 0} calls={usage.data?.today.calls ?? 0} />
                <UsageStatCard label="Bulan Ini" total={usage.data?.month.total ?? 0} calls={usage.data?.month.calls ?? 0} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">30 Hari Terakhir</p>
                {(usage.data?.daily ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Belum ada usage</p>
                ) : (
                  <div className="flex items-end gap-0.5 h-24">
                    {(usage.data?.daily ?? []).map((d) => {
                      const h = Math.max(2, Math.round((d.total / maxDaily) * 96))
                      return (
                        <div
                          key={d.date}
                          className="flex-1 bg-tertiary/40 hover:bg-tertiary/60 rounded-t group relative"
                          style={{ height: `${h}px` }}
                          title={`${d.date}: ${d.total.toLocaleString("id-ID")} token (${d.calls} calls)`}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground/50 text-center">
        Pengaturan ini override env var `OPENROUTER_API_KEY`. Setelah save, agent auto-reload via inotifywait (~3 detik).
        AI assistant offline sementara waktu reload.
      </div>
    </div>
  )
}

function UsageStatCard({ label, total, calls }: { label: string; total: number; calls: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-headline font-bold text-foreground">
        {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
        <span className="text-xs font-normal text-muted-foreground"> token</span>
      </p>
      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{calls} call</p>
    </div>
  )
}
