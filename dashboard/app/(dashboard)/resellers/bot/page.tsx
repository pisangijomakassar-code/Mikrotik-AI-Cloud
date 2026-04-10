"use client"

import { useState, useEffect } from "react"
import { BotMessageSquare, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"

export default function ResellerBotPage() {
  const [botToken, setBotToken] = useState("")
  const [savedToken, setSavedToken] = useState("")
  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // Fetch current bot status
  useEffect(() => {
    fetch("/api/resellers/bot")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSavedToken(data.token || "")
          setBotToken(data.token || "")
          setIsActive(!!data.active)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleActivate() {
    if (!botToken.trim()) {
      toast.error("Enter a bot token")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/resellers/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: botToken.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to activate bot" }))
        throw new Error(err.error || "Failed to activate bot")
      }
      setSavedToken(botToken.trim())
      setIsActive(true)
      toast.success("Reseller bot activated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate bot")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    setSaving(true)
    try {
      const res = await fetch("/api/resellers/bot", {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to deactivate bot" }))
        throw new Error(err.error || "Failed to deactivate bot")
      }
      setSavedToken("")
      setBotToken("")
      setIsActive(false)
      toast.success("Reseller bot deactivated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate bot")
    } finally {
      setSaving(false)
    }
  }

  function maskToken(token: string): string {
    if (!token) return ""
    if (token.length <= 10) return token
    return token.slice(0, 6) + "..." + token.slice(-4)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">
            Reseller Bot
          </h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <BotMessageSquare className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Configure a Telegram bot for reseller self-service.
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        {/* Setup Card */}
        <div className="bg-[rgba(15,23,42,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-8">
          {/* Status Indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                isActive
                  ? "bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.5)]"
                  : "bg-slate-600"
              )}
            />
            <span className={cn(
              "text-sm font-bold",
              isActive ? "text-[#4ae176]" : "text-slate-400"
            )}>
              {loading ? "Loading..." : isActive ? "Bot Active" : "Bot Inactive"}
            </span>
          </div>

          {/* Token Input */}
          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
              Bot Token
            </label>
            <div className="relative">
              <Input
                className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 pr-12 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                placeholder="123456789:ABCDefGhIJKlMNOpQRsTUVWxyz"
                type={showToken ? "text" : "password"}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#4cd7f6] transition-colors"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isActive && savedToken && (
              <p className="text-xs text-slate-500 ml-1">
                Current token: {maskToken(savedToken)}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {!isActive ? (
              <button
                onClick={handleActivate}
                disabled={saving || loading || !botToken.trim()}
                className="bg-gradient-to-br from-[#4ae176] to-[#22c55e] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
              >
                {saving ? "Activating..." : "Activate Bot"}
              </button>
            ) : (
              <>
                <button
                  onClick={handleActivate}
                  disabled={saving || loading || !botToken.trim() || botToken === savedToken}
                  className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Update Token"}
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={saving || loading}
                  className="bg-[#93000a]/20 text-[#ffb4ab] font-headline font-bold px-8 py-2.5 rounded-lg hover:bg-[#93000a]/30 transition-colors disabled:opacity-70"
                >
                  {saving ? "Deactivating..." : "Deactivate Bot"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-[rgba(15,23,42,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
          >
            <span className="text-sm font-bold text-[#dae2fd]">Cara Setup Reseller Bot</span>
            {showInstructions ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>
          {showInstructions && (
            <div className="px-6 pb-6 space-y-4">
              <div className="border-t border-white/5 mb-4" />
              {[
                { step: 1, text: "Buka @BotFather di Telegram" },
                { step: 2, text: "Kirim /newbot dan ikuti instruksi" },
                { step: 3, text: "Salin token yang diberikan" },
                { step: 4, text: "Paste token di atas dan klik Aktifkan" },
                { step: 5, text: "Daftarkan reseller melalui menu Reseller List" },
                { step: 6, text: "Reseller bisa mulai menggunakan bot" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#4cd7f6]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#4cd7f6]">{step}</span>
                  </div>
                  <p className="text-sm text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
