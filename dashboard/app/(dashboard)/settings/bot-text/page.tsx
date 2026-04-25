"use client"

import { useState, useEffect } from "react"
import { MessageSquareText, Save, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

const BOT_TEXT_KEYS = [
  { key: "bot_text_welcome", label: "Pesan Selamat Datang (/start)", vars: "{name}, {saldo}" },
  { key: "bot_text_not_registered", label: "Pesan Belum Terdaftar", vars: "-" },
  { key: "bot_text_saldo", label: "Pesan Info Saldo", vars: "{saldo}" },
  { key: "bot_text_buy_confirm", label: "Konfirmasi Beli Voucher", vars: "{nama}, {harga}, {saldo_setelah}" },
  { key: "bot_text_buy_success", label: "Voucher Berhasil Dibeli", vars: "{username}, {password}, {saldo}" },
  { key: "bot_text_deposit_info", label: "Info Request Deposit", vars: "-" },
  { key: "bot_text_deposit_req", label: "Permintaan Deposit Terkirim", vars: "{nominal}" },
  { key: "bot_text_deposit_sent", label: "Deposit Dikonfirmasi Admin", vars: "{nominal}, {saldo}" },
] as const

const DEFAULTS: Record<string, string> = {
  bot_text_welcome: "Halo {name}! Saldo: {saldo}",
  bot_text_not_registered: "Anda belum terdaftar. Hubungi admin untuk didaftarkan.",
  bot_text_saldo: "Saldo Anda: {saldo}",
  bot_text_buy_confirm: "Konfirmasi beli voucher {nama}?\nHarga: {harga}\nSaldo setelah: {saldo_setelah}",
  bot_text_buy_success: "✅ Voucher berhasil dibeli!\nUsername: {username}\nPassword: {password}\nSisa saldo: {saldo}",
  bot_text_deposit_info: "Pilih nominal deposit:",
  bot_text_deposit_req: "Permintaan deposit {nominal} telah dikirim ke admin.",
  bot_text_deposit_sent: "✅ Deposit {nominal} berhasil dikonfirmasi. Saldo baru: {saldo}",
}

export default function BotTextSettingsPage() {
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/bot-texts")
      .then((r) => r.json())
      .then((data) => setTexts(data))
      .catch(() => toast.error("Gagal memuat teks bot"))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/bot-texts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(texts),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Teks bot berhasil disimpan")
    } catch {
      toast.error("Gagal menyimpan teks bot")
    } finally {
      setSaving(false)
    }
  }

  function resetKey(key: string) {
    setTexts((prev) => ({ ...prev, [key]: DEFAULTS[key] ?? "" }))
  }

  function resetAll() {
    setTexts({ ...DEFAULTS })
    toast.info("Semua teks direset ke default")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-1">Bot Text</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <MessageSquareText className="h-[18px] w-[18px] text-primary shrink-0" />
            Kustomisasi teks pesan yang dikirim bot reseller ke Telegram.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={resetAll} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-sm font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
            <RotateCcw className="h-4 w-4" /> Reset Semua
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-6 py-2.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-60"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="h-4 w-4" /> Simpan Semua</>}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {BOT_TEXT_KEYS.map(({ key, label, vars }) => (
          <div key={key} className="bg-surface-low rounded-2xl border border-border/20 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-foreground">{label}</p>
                {vars !== "-" && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Variabel tersedia: <span className="font-mono-tech text-primary">{vars}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => resetKey(key)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                title="Reset ke default"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              value={texts[key] ?? ""}
              onChange={(e) => setTexts((prev) => ({ ...prev, [key]: e.target.value }))}
              rows={3}
              className="w-full bg-muted border-none rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none resize-none font-mono-tech"
              placeholder={DEFAULTS[key]}
            />
            {texts[key] !== DEFAULTS[key] && (
              <p className="text-[10px] text-primary mt-1.5">Telah dimodifikasi dari default</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
