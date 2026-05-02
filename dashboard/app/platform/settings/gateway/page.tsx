"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mail, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface GatewaySettings {
  smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string; smtpFrom: string; smtpSecure: boolean
  smsProvider: string; smsApiKey: string; smsFrom: string
  _hasSmtpPass?: boolean; _hasSmsKey?: boolean
}

const DEFAULT: GatewaySettings = {
  smtpHost: "", smtpPort: 587, smtpUser: "", smtpPass: "", smtpFrom: "", smtpSecure: false,
  smsProvider: "none", smsApiKey: "", smsFrom: "",
}

export default function GatewayPage() {
  const [data, setData] = useState<GatewaySettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/platform/settings/gateway")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  function set(key: keyof GatewaySettings, value: unknown) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/platform/settings/gateway", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) toast.success("Gateway settings saved")
      else toast.error("Failed to save")
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
          <Mail className="h-7 w-7 text-[#4cd7f6]" /> Email / SMS Gateway
        </h2>
        <p className="text-muted-foreground">Transactional email and SMS provider configuration</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : (
        <form onSubmit={handleSave} className="max-w-lg space-y-6">
          {/* SMTP */}
          <div className="card-glass rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">SMTP (Email)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Host</Label>
                <Input value={data.smtpHost} onChange={e => set("smtpHost", e.target.value)} placeholder="smtp.example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input type="number" value={data.smtpPort} onChange={e => set("smtpPort", parseInt(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={data.smtpUser} onChange={e => set("smtpUser", e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={data.smtpPass}
                  onChange={e => set("smtpPass", e.target.value)}
                  placeholder={data._hasSmtpPass ? "Leave blank to keep" : "Password…"}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>From Address</Label>
              <Input value={data.smtpFrom} onChange={e => set("smtpFrom", e.target.value)} placeholder="noreply@yourdomain.com" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={data.smtpSecure} onCheckedChange={v => set("smtpSecure", v)} />
              <Label className="cursor-pointer">Use TLS/SSL</Label>
            </div>
          </div>

          {/* SMS */}
          <div className="card-glass rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">SMS Provider</h3>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={data.smsProvider} onValueChange={v => set("smsProvider", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (disabled)</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="vonage">Vonage (Nexmo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {data.smsProvider !== "none" && (
              <>
                <div className="space-y-1.5">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={data.smsApiKey}
                    onChange={e => set("smsApiKey", e.target.value)}
                    placeholder={data._hasSmsKey ? "Leave blank to keep" : "API key…"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>From Number</Label>
                  <Input value={data.smsFrom} onChange={e => set("smsFrom", e.target.value)} placeholder="+628001234567" />
                </div>
              </>
            )}
          </div>

          <Button type="submit" disabled={saving}
            className="w-full bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Gateway Config
          </Button>
        </form>
      )}
    </div>
  )
}
