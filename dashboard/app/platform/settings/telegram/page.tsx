"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Send, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface TelegramConfig {
  botToken: string; botUsername: string; adminChatId: string
  notifyOnNewTenant: boolean; notifyOnExpiry: boolean; notifyOnError: boolean
  _hasBotToken?: boolean
}

const DEFAULT: TelegramConfig = {
  botToken: "", botUsername: "", adminChatId: "",
  notifyOnNewTenant: true, notifyOnExpiry: true, notifyOnError: false,
}

export default function TelegramConfigPage() {
  const [data, setData] = useState<TelegramConfig>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/platform/settings/telegram-config")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  function set(key: keyof TelegramConfig, value: unknown) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/platform/settings/telegram-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) toast.success("Telegram config saved")
      else toast.error("Failed to save")
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
          <Send className="h-7 w-7 text-[#4cd7f6]" /> Telegram Bot Config
        </h2>
        <p className="text-muted-foreground">Global platform bot — admin alerts and system notifications</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : (
        <form onSubmit={handleSave} className="max-w-lg space-y-6">
          <div className="card-glass rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Bot Credentials</h3>
            <div className="space-y-1.5">
              <Label>Bot Token</Label>
              <Input
                type="password"
                value={data.botToken}
                onChange={e => set("botToken", e.target.value)}
                placeholder={data._hasBotToken ? "Leave blank to keep existing token" : "1234567890:AAAA…"}
              />
              {data._hasBotToken && (
                <p className="text-xs text-[#869397]">Token is set — leave blank to keep it</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Bot Username</Label>
              <Input value={data.botUsername} onChange={e => set("botUsername", e.target.value)} placeholder="@MyPlatformBot" />
            </div>
            <div className="space-y-1.5">
              <Label>Admin Chat ID</Label>
              <Input value={data.adminChatId} onChange={e => set("adminChatId", e.target.value)} placeholder="-100123456789" />
              <p className="text-xs text-[#869397]">Group or user chat ID to receive platform alerts</p>
            </div>
          </div>

          <div className="card-glass rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Notification Triggers</h3>
            {([
              { key: "notifyOnNewTenant", label: "New tenant registered" },
              { key: "notifyOnExpiry", label: "Subscription expiring soon" },
              { key: "notifyOnError", label: "System errors / failed jobs" },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="cursor-pointer">{label}</Label>
                <Switch checked={data[key] as boolean} onCheckedChange={v => set(key, v)} />
              </div>
            ))}
          </div>

          <Button type="submit" disabled={saving}
            className="w-full bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Telegram Config
          </Button>
        </form>
      )}
    </div>
  )
}
