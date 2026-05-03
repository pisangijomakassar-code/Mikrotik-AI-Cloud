"use client"

import { useEffect, useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BotMessageSquare, Eye, EyeOff, Webhook, RefreshCw, Loader2,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Copy, Check,
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { useActiveRouter } from "@/components/active-router-context"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface BotConfig {
  routerId: string
  routerName: string
  token: string
  hasToken: boolean
  botUsername: string
  telegramOwnerUsername: string
  telegramOwnerId: string
  active: boolean
  webhookBaseUrl?: string
}

interface BotInfo {
  routerId: string
  routerName: string
  bot: { id?: number; username?: string; firstName?: string }
  webhook: {
    url?: string
    pending_update_count?: number
    last_error_date?: number
    last_error_message?: string
    max_connections?: number
    has_custom_certificate?: boolean
  }
  mode: "webhook" | "polling"
  active: boolean
}

export default function ResellerBotPage() {
  const { activeRouter, activeRouterData } = useActiveRouter()
  const routerId = activeRouterData?.id ?? ""
  const qc = useQueryClient()

  const [tokenInput, setTokenInput] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch bot config (token, username) per router
  const configQuery = useQuery<BotConfig>({
    queryKey: ["bot-config", routerId],
    queryFn: () => apiClient.get<BotConfig>(`/api/resellers/bot?routerId=${routerId}`),
    enabled: !!routerId,
    retry: false,
  })

  // Suggested webhook URL — pakai WEBHOOK_BASE_URL dari server jika ada (HTTPS),
  // fallback ke window.location.origin (bisa HTTP, hanya untuk dev/lokal).
  const webhookBase = configQuery.data?.webhookBaseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "")
  const suggestedWebhookUrl = webhookBase
    ? `${webhookBase}/api/telegram/webhook/${routerId || ""}`
    : ""

  // Fetch live bot info (getMe + getWebhookInfo) — only when token is set
  const infoQuery = useQuery<BotInfo>({
    queryKey: ["bot-info", routerId],
    queryFn: () => apiClient.get<BotInfo>(`/api/resellers/bot/info?routerId=${routerId}`),
    enabled: !!routerId && !!configQuery.data?.hasToken,
    retry: false,
    refetchInterval: 30_000,
  })

  // Sync local input dgn data dari server
  useEffect(() => {
    if (configQuery.data) {
      setTokenInput(configQuery.data.token || "")
    }
  }, [configQuery.data])

  useEffect(() => {
    if (infoQuery.data?.webhook?.url) {
      setUrlInput(infoQuery.data.webhook.url)
    } else if (suggestedWebhookUrl && !urlInput) {
      setUrlInput(suggestedWebhookUrl)
    }
  }, [infoQuery.data, suggestedWebhookUrl, urlInput])

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["bot-config", routerId] })
    qc.invalidateQueries({ queryKey: ["bot-info", routerId] })
  }, [qc, routerId])

  async function handleSetBoth() {
    if (!routerId) return
    const token = tokenInput.trim()
    if (!token) { toast.error("Masukkan bot token dulu"); return }

    setSaving(true)
    try {
      // 1) Simpan/update token (verify via getMe di backend)
      if (token !== configQuery.data?.token) {
        await apiClient.post(`/api/resellers/bot?routerId=${routerId}`, { token })
        toast.success("Bot token tersimpan + verified")
      }

      // 2) Set webhook URL (kalau ada)
      const url = urlInput.trim()
      if (url) {
        if (!url.startsWith("https://")) {
          toast.error("URL webhook harus HTTPS"); return
        }
        const res = await apiClient.post<{ ok: boolean; description?: string }>(
          `/api/resellers/bot/info?routerId=${routerId}`,
          { url }
        )
        if (res.ok) {
          toast.success("Webhook berhasil di-set")
        } else {
          toast.error(res.description || "Set webhook gagal")
        }
      }
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal save")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnsetWebhook() {
    if (!routerId) return
    setSaving(true)
    try {
      const res = await apiClient.delete<{ ok: boolean; description?: string }>(
        `/api/resellers/bot/info?routerId=${routerId}`
      )
      if (res.ok) toast.success("Webhook dihapus, bot pakai polling")
      else toast.error(res.description || "Gagal unset webhook")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal")
    } finally {
      setSaving(false)
    }
  }

  async function handleRestart() {
    if (!routerId) return
    setSaving(true)
    try {
      const res = await apiClient.post<{ ok: boolean; status?: string; message?: string }>(
        `/api/resellers/bot/restart?routerId=${routerId}`
      )
      if (res.ok) toast.success(res.message || `Bot ${res.status}`)
      else toast.error(res.message || "Gagal restart bot")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal restart")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!routerId) return
    if (!confirm("Hapus bot token dari router ini? (Webhook juga di-unset, bot stop bekerja)")) return
    setSaving(true)
    try {
      // Unset webhook dulu, lalu hapus token
      try { await apiClient.delete(`/api/resellers/bot/info?routerId=${routerId}`) } catch {}
      await apiClient.delete(`/api/resellers/bot?routerId=${routerId}`)
      setTokenInput("")
      toast.success("Bot dinonaktifkan")
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal")
    } finally {
      setSaving(false)
    }
  }

  function copyUrl() {
    const url = urlInput || suggestedWebhookUrl
    if (!url) return
    const write = navigator.clipboard
      ? navigator.clipboard.writeText(url).catch(() => fallbackCopy(url))
      : Promise.resolve(fallbackCopy(url))
    write.then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  function fallbackCopy(text: string) {
    const el = document.createElement("textarea")
    el.value = text
    el.style.cssText = "position:fixed;opacity:0;pointer-events:none"
    document.body.appendChild(el)
    el.select()
    document.execCommand("copy")
    document.body.removeChild(el)
  }

  function maskToken(t: string): string {
    if (!t) return ""
    if (t.length <= 12) return t
    return t.slice(0, 8) + "..." + t.slice(-6)
  }

  if (!activeRouter) {
    return (
      <div className="card-glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
        Pilih router dulu di header untuk konfigurasi bot
      </div>
    )
  }

  const hasToken = !!configQuery.data?.hasToken
  const info = infoQuery.data
  const hasWebhook = !!(info?.webhook?.url && info.webhook.url.length > 0)
  const pendingCount = info?.webhook?.pending_update_count ?? 0
  const lastError = info?.webhook?.last_error_message

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BotMessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold text-foreground">Reseller Bot</h1>
          </div>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Router <span className="text-primary font-mono">{activeRouter}</span>
            {info?.bot?.username && <> · @{info.bot.username}</>}
            {info && <> · mode: <span className="text-orange-400 font-bold">{info.mode}</span></>}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={configQuery.isFetching || infoQuery.isFetching}
          className="card-glass rounded-xl px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", (configQuery.isFetching || infoQuery.isFetching) && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Two-column Mikhbotam-style layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SET WEBHOOK */}
        <div className="card-glass rounded-2xl overflow-hidden">
          <div className="bg-tertiary/15 border-b border-tertiary/20 px-5 py-3 flex items-center gap-2">
            <Webhook className="h-4 w-4 text-tertiary" />
            <h3 className="text-sm font-bold text-tertiary">Set Webhook</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Token Input */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
                Token bot
              </label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder="123456789:AAEx..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="font-mono text-xs pr-10"
                  disabled={configQuery.isLoading || saving}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* URL Input */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
                URL to Bot
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder={suggestedWebhookUrl}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="font-mono text-xs flex-1"
                  disabled={saving}
                />
                {suggestedWebhookUrl && (
                  <button
                    type="button"
                    onClick={copyUrl}
                    title="Copy suggested URL"
                    className="card-glass rounded-lg px-2 hover:bg-white/5"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-tertiary" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Kosongkan kalau cuma mau save token (mode polling). Wajib HTTPS untuk webhook.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleSetBoth}
                disabled={saving || !tokenInput.trim()}
                className="bg-tertiary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "👍"}
                Set webhook
              </button>
              {hasWebhook && (
                <button
                  onClick={handleUnsetWebhook}
                  disabled={saving}
                  className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-orange-500/30 disabled:opacity-60"
                >
                  🗑 Unset webhook
                </button>
              )}
              {hasToken && (
                <>
                  <button
                    onClick={handleRestart}
                    disabled={saving}
                    title="Hot-reload bot tanpa restart container (apply perubahan token/webhook)"
                    className="bg-primary/15 text-primary border border-primary/30 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-primary/25 disabled:opacity-60 ml-auto"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", saving && "animate-spin")} />
                    Restart Bot
                  </button>
                  <button
                    onClick={handleDeactivate}
                    disabled={saving}
                    className="bg-destructive/15 text-destructive border border-destructive/30 text-xs font-bold px-4 py-2 rounded-lg hover:bg-destructive/25 disabled:opacity-60"
                  >
                    Deactivate Bot
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* GET WEBHOOK INFO */}
        <div className="card-glass rounded-2xl overflow-hidden">
          <div className="bg-tertiary/15 border-b border-tertiary/20 px-5 py-3 flex items-center gap-2">
            <BotMessageSquare className="h-4 w-4 text-tertiary" />
            <h3 className="text-sm font-bold text-tertiary">Get Webhook Info</h3>
          </div>
          <div className="p-5 space-y-3 text-sm">
            {!hasToken ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <XCircle className="h-5 w-5 text-slate-500" />
                <span className="text-sm">Bot belum dikonfigurasi untuk router ini</span>
              </div>
            ) : infoQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Memuat info dari Telegram...</span>
              </div>
            ) : infoQuery.isError ? (
              <div className="flex items-start gap-2 text-destructive py-2">
                <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="text-xs">
                  Gagal fetch info — token mungkin invalid atau Telegram unreachable.
                  Cek token di kiri & klik refresh.
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge color="green" icon={<CheckCircle2 className="h-3 w-3" />}>
                    Active{info?.bot?.username ? ` · @${info.bot.username}` : ""}
                  </Badge>
                  <Badge color={pendingCount > 0 ? "orange" : "slate"}>
                    Perintah Pending {pendingCount}
                  </Badge>
                  <Badge color={hasWebhook ? "tertiary" : "slate"}>
                    Mode: {info?.mode || "polling"}
                  </Badge>
                </div>

                <FieldRow label="Token bot Active" value={maskToken(configQuery.data?.token || "")} mono />
                <FieldRow
                  label="URL Active"
                  value={hasWebhook ? (info?.webhook?.url || "") : "(tidak diset, polling mode)"}
                  mono
                  break
                />
                {info?.webhook?.max_connections !== undefined && hasWebhook && (
                  <FieldRow label="Max Connections" value={String(info.webhook.max_connections)} />
                )}
                {info?.webhook?.has_custom_certificate && hasWebhook && (
                  <FieldRow label="Custom Cert" value="Ya (self-signed)" />
                )}
                {lastError && (
                  <div className="bg-destructive/10 rounded-xl p-3 border border-destructive/20">
                    <p className="text-[10px] text-destructive uppercase tracking-widest font-bold mb-1">
                      Error Terakhir
                    </p>
                    <p className="text-xs text-destructive">{lastError}</p>
                    {info?.webhook?.last_error_date && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(info.webhook.last_error_date * 1000).toLocaleString("id-ID")}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="card-glass rounded-2xl overflow-hidden max-w-3xl">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30"
        >
          <span className="text-sm font-bold text-foreground">Cara Setup Reseller Bot</span>
          {showInstructions ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
        </button>
        {showInstructions && (
          <div className="px-5 pb-5 space-y-3 text-sm text-muted-foreground">
            {[
              "Buka @BotFather di Telegram, kirim /newbot, ikuti instruksi.",
              "Salin token (format 123456789:AAExx...) yang diberikan.",
              "Paste token di field 'Token bot' kiri.",
              "Untuk webhook mode: pastikan URL HTTPS reachable publik (Cloudflare Tunnel/caddy). Klik Set webhook.",
              "Untuk polling mode (dev/lokal): kosongkan URL, klik Set webhook (cuma save token).",
              "Daftarkan reseller via menu Reseller List supaya bisa pakai bot.",
              "Catatan: mengubah token tidak otomatis restart bot — perlu restart container mikrotik-agent (atau tunggu auto-reload).",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Badge({ children, color, icon }: { children: React.ReactNode; color: "green" | "orange" | "slate" | "tertiary"; icon?: React.ReactNode }) {
  const cls = {
    green: "bg-tertiary/20 text-tertiary border-tertiary/30",
    tertiary: "bg-tertiary/15 text-tertiary border-tertiary/30",
    orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    slate: "bg-white/5 text-slate-400 border-white/10",
  }[color]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-bold", cls)}>
      {icon}
      {children}
    </span>
  )
}

function FieldRow({ label, value, mono, break: doBreak }: { label: string; value: string; mono?: boolean; break?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-muted-foreground/70 w-32 shrink-0 pt-0.5">{label}</span>
      <span className={cn("flex-1 text-foreground", mono && "font-mono", doBreak && "break-all")}>{value || "-"}</span>
    </div>
  )
}
