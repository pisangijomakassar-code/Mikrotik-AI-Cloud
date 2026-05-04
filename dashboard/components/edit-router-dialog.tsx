"use client"

import { useState, useEffect } from "react"
import { X, Wifi, WifiOff, Loader2 } from "lucide-react"
import { useUpdateRouter } from "@/hooks/use-routers"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { RouterData } from "@/hooks/use-routers"

interface EditRouterDialogProps {
  router: RouterData
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditRouterDialog({ router, open, onOpenChange }: EditRouterDialogProps) {
  const [name, setName] = useState(router.name)
  const [host, setHost] = useState(router.host)
  const [port, setPort] = useState(String(router.port || 8728))
  const [username, setUsername] = useState(router.username)
  const [password, setPassword] = useState("")
  const [label, setLabel] = useState(router.label ?? "")
  const [isDefault, setIsDefault] = useState(router.isDefault)

  // WAN interface untuk kalkulasi traffic
  const [wanInterface, setWanInterface] = useState(router.wanInterface ?? "")

  // MikroTik DNS settings
  const [dnsHotspot, setDnsHotspot] = useState(router.dnsHotspot ?? "")
  const [hotspotName, setHotspotName] = useState(router.hotspotName ?? "")
  const [hotspotLogoUrl, setHotspotLogoUrl] = useState(router.hotspotLogoUrl ?? "")

  // Telegram bot integration (optional)
  const [telegramOwnerUsername, setTelegramOwnerUsername] = useState(router.telegramOwnerUsername ?? "")
  const [telegramOwnerId, setTelegramOwnerId] = useState(router.telegramOwnerId ?? "")
  const [botToken, setBotToken] = useState("")
  const [botUsername, setBotUsername] = useState(router.botUsername ?? "")

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle")
  const [testMessage, setTestMessage] = useState("")

  const updateRouter = useUpdateRouter()

  /** Split "host:port" input into separate host + port fields on blur */
  function handleHostBlur() {
    const trimmed = host.trim()
    const lastColon = trimmed.lastIndexOf(":")
    if (lastColon === -1) return
    const potentialPort = trimmed.slice(lastColon + 1)
    const portNum = parseInt(potentialPort, 10)
    if (potentialPort && !isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
      setHost(trimmed.slice(0, lastColon))
      setPort(potentialPort)
    }
  }

  // Reset form when router changes
  useEffect(() => {
    setName(router.name)
    setHost(router.host)
    setPort(String(router.port || 8728))
    setUsername(router.username)
    setPassword("")
    setLabel(router.label ?? "")
    setIsDefault(router.isDefault)
    setWanInterface(router.wanInterface ?? "")
    setDnsHotspot(router.dnsHotspot ?? "")
    setHotspotName(router.hotspotName ?? "")
    setHotspotLogoUrl(router.hotspotLogoUrl ?? "")
    setTelegramOwnerUsername(router.telegramOwnerUsername ?? "")
    setTelegramOwnerId(router.telegramOwnerId ?? "")
    setBotToken("")
    setBotUsername(router.botUsername ?? "")
    setTestStatus("idle")
    setTestMessage("")
  }, [router])

  async function handleTestConnection() {
    if (!host.trim() || !port) { toast.error("Isi host dan port dulu"); return }
    if (!username.trim() || !password) {
      toast.error("Isi username dan password baru untuk test login ke MikroTik")
      return
    }
    setTestStatus("testing")
    setTestMessage("")
    try {
      const res = await fetch("/api/routers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: host.trim(),
          port,
          username: username.trim(),
          password,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTestStatus("success")
        setTestMessage(data.message)
      } else {
        setTestStatus("failed")
        setTestMessage(data.message)
      }
    } catch {
      setTestStatus("failed")
      setTestMessage("Gagal menghubungi server")
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !host.trim() || !username.trim()) {
      toast.error("Nama, host, dan username wajib diisi")
      return
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || 8728,
      username: username.trim(),
      label: label.trim() || "",
      isDefault,
      wanInterface: wanInterface.trim(),
      dnsHotspot: dnsHotspot.trim(),
      hotspotName: hotspotName.trim(),
      hotspotLogoUrl: hotspotLogoUrl.trim(),
      telegramOwnerUsername: telegramOwnerUsername.trim(),
      telegramOwnerId: telegramOwnerId.trim(),
      botUsername: botUsername.trim(),
    }
    // Only send password if user typed a new one
    if (password) payload.password = password
    // Only send botToken if user typed a new one (empty = keep existing)
    if (botToken) payload.botToken = botToken

    updateRouter.mutate(
      { id: router.id, data: payload },
      {
        onSuccess: () => {
          toast.success("Router berhasil diperbarui")
          onOpenChange(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">Edit Router</h3>
            <p className="text-sm text-muted-foreground/70">{router.name}</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-4 md:p-8 space-y-6">

            {/* Name & Label */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Nama Router</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Label (Opsional)</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="e.g. Kantor Cabang"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Host / IP Address</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="192.168.88.1 atau host:port"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  onBlur={handleHostBlur}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Port</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Username</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                  Password Baru <span className="text-muted-foreground/40 normal-case">(kosongkan = tidak diubah)</span>
                </label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="Isi jika ingin ganti password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Test Connection (below credentials, tests full login) */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === "testing" || !host.trim() || !username.trim() || !password}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-all disabled:opacity-50"
              >
                {testStatus === "testing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : testStatus === "success" ? (
                  <Wifi className="h-4 w-4 text-tertiary" />
                ) : testStatus === "failed" ? (
                  <WifiOff className="h-4 w-4 text-red-400" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                {testStatus === "testing" ? "Mengecek login..." : "Test Koneksi (Login ke MikroTik)"}
              </button>
              {!password && (
                <span className="text-xs text-muted-foreground/60">
                  Isi password baru dulu untuk test login
                </span>
              )}
              {testMessage && (
                <span className={cn("text-xs", testStatus === "success" ? "text-tertiary" : "text-red-400")}>
                  {testMessage}
                </span>
              )}
            </div>

            {/* ── Hotspot Branding (untuk cetak voucher & QR login) ── */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Hotspot Branding</h4>
              <div className="space-y-2 mb-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                  WAN Interface <span className="text-muted-foreground/40 normal-case">(untuk kalkulasi traffic, contoh: ether1-INTERNET)</span>
                </label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="e.g. ether1-INTERNET"
                  type="text"
                  value={wanInterface}
                  onChange={(e) => setWanInterface(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    DNS Hotspot <span className="text-muted-foreground/40 normal-case">(URL login QR)</span>
                  </label>
                  <Input
                    className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                    placeholder="e.g. toko.net"
                    type="text"
                    value={dnsHotspot}
                    onChange={(e) => setDnsHotspot(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Nama Hotspot <span className="text-muted-foreground/40 normal-case">(header voucher)</span>
                  </label>
                  <Input
                    className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                    placeholder="e.g. Cafe WiFi"
                    type="text"
                    value={hotspotName}
                    onChange={(e) => setHotspotName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                  Logo Hotspot URL <span className="text-muted-foreground/40 normal-case">(opsional, untuk header voucher)</span>
                </label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="https://.../logo.png"
                  type="text"
                  value={hotspotLogoUrl}
                  onChange={(e) => setHotspotLogoUrl(e.target.value)}
                />
              </div>
            </div>

            {/* ── Owner (Telegram) ── */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Owner (Telegram)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Username Owner <span className="text-muted-foreground/40 normal-case">(Opsional)</span>
                  </label>
                  <Input
                    className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                    placeholder="@BubudPisjo"
                    type="text"
                    value={telegramOwnerUsername}
                    onChange={(e) => setTelegramOwnerUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    ID Telegram Owner <span className="text-muted-foreground/40 normal-case">(Opsional)</span>
                  </label>
                  <Input
                    className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                    placeholder="86340875"
                    type="text"
                    value={telegramOwnerId}
                    onChange={(e) => setTelegramOwnerId(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Bot Settings ── */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Bot Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Token Bot Baru <span className="text-muted-foreground/40 normal-case">(kosongkan = tidak diubah)</span>
                  </label>
                  <Input
                    className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                    placeholder="Isi jika ingin ganti token"
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Username Bot <span className="text-muted-foreground/40 normal-case">(Opsional)</span>
                  </label>
                  <Input
                    className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                    placeholder="ummiwifi_bot"
                    type="text"
                    value={botUsername}
                    onChange={(e) => setBotUsername(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Default Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
              <span className="text-xs text-muted-foreground">Jadikan router utama (default)</span>
              <div
                className={cn("w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors", isDefault ? "bg-[#4ae176]/20" : "bg-muted-foreground/20")}
                onClick={() => setIsDefault(!isDefault)}
              >
                <div className={cn("absolute top-1 w-3 h-3 rounded-full transition-all", isDefault ? "right-1 bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.5)]" : "left-1 bg-muted-foreground/50")} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4 border-t border-border shrink-0">
            <button type="button" onClick={() => onOpenChange(false)} className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={updateRouter.isPending}
              className="bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {updateRouter.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
