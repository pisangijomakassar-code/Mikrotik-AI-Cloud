"use client"

import { useState, useEffect } from "react"
import { Webhook, CheckCircle2, XCircle, RefreshCw, Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

interface WebhookInfo {
  ok: boolean
  result?: {
    url: string
    has_custom_certificate: boolean
    pending_update_count: number
    last_error_date?: number
    last_error_message?: string
    max_connections?: number
    allowed_updates?: string[]
  }
}

export default function WebhookSettingsPage() {
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [customUrl, setCustomUrl] = useState("")
  const [setting, setSetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Auto-detect app URL for webhook
  const appUrl = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
    : ""
  const suggestedWebhookUrl = appUrl ? `${appUrl}/api/telegram/webhook` : ""

  async function fetchInfo() {
    setLoadingInfo(true)
    try {
      const res = await fetch("/api/bot/webhook")
      if (res.ok) {
        const data = await res.json()
        setWebhookInfo(data)
      } else {
        const err = await res.json().catch(() => ({}))
        if (err.error !== "Bot token not configured") toast.error(err.error || "Gagal memuat info webhook")
        setWebhookInfo(null)
      }
    } catch {
      toast.error("Gagal memuat info webhook")
    } finally {
      setLoadingInfo(false)
    }
  }

  useEffect(() => { fetchInfo() }, [])

  async function handleSet() {
    const url = customUrl.trim() || suggestedWebhookUrl
    if (!url) { toast.error("Masukkan URL webhook"); return }
    setSetting(true)
    try {
      const res = await fetch("/api/bot/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("Webhook berhasil diset!")
        await fetchInfo()
      } else {
        toast.error(data.description || "Gagal set webhook")
      }
    } catch {
      toast.error("Gagal set webhook")
    } finally {
      setSetting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch("/api/bot/webhook", { method: "DELETE" })
      const data = await res.json()
      if (data.ok) {
        toast.success("Webhook dihapus. Bot beralih ke polling.")
        await fetchInfo()
      } else {
        toast.error(data.description || "Gagal hapus webhook")
      }
    } catch {
      toast.error("Gagal hapus webhook")
    } finally {
      setDeleting(false)
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const hasWebhook = webhookInfo?.result?.url && webhookInfo.result.url.length > 0
  const lastError = webhookInfo?.result?.last_error_message

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-1">Webhook Config</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Webhook className="h-[18px] w-[18px] text-primary shrink-0" />
            Konfigurasi webhook Telegram untuk bot reseller.
          </p>
        </div>
        <button onClick={fetchInfo} disabled={loadingInfo} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-sm font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loadingInfo ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Status Card */}
        <div className="bg-surface-low rounded-3xl border border-border/20 p-6">
          <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest mb-4">Status Webhook</h3>

          {loadingInfo ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Memuat info webhook...</span>
            </div>
          ) : !webhookInfo ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm">Bot token belum dikonfigurasi. Set token di menu <strong>Reseller Bot</strong> terlebih dahulu.</span>
            </div>
          ) : hasWebhook ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-tertiary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">Webhook Aktif</p>
                  <p className="text-xs font-mono-tech text-primary break-all mt-1">{webhookInfo.result?.url}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Pending Updates</p>
                  <p className="text-lg font-headline font-bold text-foreground mt-0.5">{webhookInfo.result?.pending_update_count ?? 0}</p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Max Connections</p>
                  <p className="text-lg font-headline font-bold text-foreground mt-0.5">{webhookInfo.result?.max_connections ?? 40}</p>
                </div>
              </div>
              {lastError && (
                <div className="bg-destructive/10 rounded-xl p-3 border border-destructive/20">
                  <p className="text-[10px] text-destructive uppercase tracking-widest font-bold mb-1">Error Terakhir</p>
                  <p className="text-xs text-destructive">{lastError}</p>
                  {webhookInfo.result?.last_error_date && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(webhookInfo.result.last_error_date * 1000).toLocaleString("id-ID")}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-slate-600" />
              <span className="text-sm text-muted-foreground">Webhook belum diset. Bot menggunakan polling.</span>
            </div>
          )}
        </div>

        {/* Set Webhook Card */}
        <div className="bg-surface-low rounded-3xl border border-border/20 p-6 space-y-4">
          <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">Set Webhook</h3>

          {suggestedWebhookUrl && (
            <div className="bg-muted rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">URL yang Disarankan</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono-tech text-primary break-all flex-1">{suggestedWebhookUrl}</p>
                <button onClick={() => copyUrl(suggestedWebhookUrl)} className="shrink-0 p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-tertiary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Pastikan URL dapat diakses publik (HTTPS). Gunakan Cloudflare Tunnel jika server di belakang NAT.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Custom URL (opsional)</label>
            <Input
              className="w-full bg-muted border-none rounded-xl py-2.5 px-3 text-sm font-mono-tech text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"
              placeholder={suggestedWebhookUrl || "https://yourdomain.com/api/telegram/webhook"}
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground/60">Kosongkan untuk menggunakan URL yang disarankan di atas.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSet}
              disabled={setting || loadingInfo || !webhookInfo}
              className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-6 py-2.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-60"
            >
              {setting ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting...</> : <><Webhook className="h-4 w-4" /> Set Webhook</>}
            </button>
            {hasWebhook && (
              <button
                onClick={handleDelete}
                disabled={deleting || loadingInfo}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-destructive/10 text-destructive font-headline font-bold hover:bg-destructive/20 transition-colors disabled:opacity-60"
              >
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Menghapus...</> : "Hapus Webhook"}
              </button>
            )}
          </div>
        </div>

        {/* Info / Keterangan */}
        <div className="bg-surface-low rounded-3xl border border-border/20 p-6 space-y-4">
          <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">Keterangan</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Webhook adalah cara Telegram mengirim update ke server kamu secara real-time, lebih efisien dibanding polling.</p>
            <ul className="space-y-2">
              {[
                "URL webhook harus HTTPS dan dapat diakses dari internet.",
                "Jika server berada di balik NAT/lokal, gunakan Cloudflare Tunnel untuk mendapatkan URL publik.",
                "Setelah webhook diset, bot tidak lagi menggunakan polling.",
                "Hapus webhook jika ingin kembali ke mode polling (untuk development/testing).",
                "Jika ada error pada webhook, cek bagian 'Error Terakhir' di atas.",
                "Allowed updates: message dan callback_query (sesuai kebutuhan bot reseller).",
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1 shrink-0">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
