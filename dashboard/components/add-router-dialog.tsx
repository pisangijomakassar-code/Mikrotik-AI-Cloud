"use client"

import { useState } from "react"
import { PlusCircle, X, Wifi, WifiOff, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { useCreateRouter } from "@/hooks/use-routers"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ── Main Component ────────────────────────────────────────────────────────────

export function AddRouterDialog() {
  const [open, setOpen] = useState(false)
  const { data: session } = useSession()

  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("8728")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [label, setLabel] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  // MikroTik DNS settings
  const [dnsHotspot, setDnsHotspot] = useState("")

  // Telegram bot integration (optional)
  const [telegramOwnerUsername, setTelegramOwnerUsername] = useState("")
  const [telegramOwnerId, setTelegramOwnerId] = useState("")
  const [botToken, setBotToken] = useState("")
  const [botUsername, setBotUsername] = useState("")

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle")
  const [testMessage, setTestMessage] = useState("")

  const createRouter = useCreateRouter()

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

  function resetForm() {
    setName("")
    setHost("")
    setPort("8728")
    setUsername("")
    setPassword("")
    setLabel("")
    setIsDefault(false)
    setDnsHotspot("")
    setTelegramOwnerUsername("")
    setTelegramOwnerId("")
    setBotToken("")
    setBotUsername("")
    setTestStatus("idle")
    setTestMessage("")
  }

  async function handleTestConnection() {
    if (!host.trim() || !port) {
      toast.error("Isi host dan port dulu")
      return
    }
    if (!username.trim() || !password) {
      toast.error("Isi username dan password untuk test login ke MikroTik")
      return
    }
    setTestStatus("testing")
    setTestMessage("")
    try {
      const res = await fetch("/api/routers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: host.trim(), port, username: username.trim(), password }),
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

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !host.trim() || !username.trim() || !password) {
      toast.error("Nama, host, username, dan password wajib diisi")
      return
    }

    createRouter.mutate(
      {
        name: name.trim(),
        host: host.trim(),
        port: parseInt(port) || 8728,
        username: username.trim(),
        password,
        label: label.trim() || undefined,
        isDefault,
        // tenantId di-inject di server (dari session)
        dnsHotspot: dnsHotspot.trim() || undefined,
        telegramOwnerUsername: telegramOwnerUsername.trim() || undefined,
        telegramOwnerId: telegramOwnerId.trim() || undefined,
        botToken: botToken.trim() || undefined,
        botUsername: botUsername.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Router berhasil ditambahkan")
          resetForm()
          setOpen(false)
        },
        onError: (err) => {
          toast.error(err.message)
        },
      }
    )
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all duration-200"
      >
        <PlusCircle className="h-4 w-4" />
        Provision Node
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 md:p-8 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-2xl font-headline font-bold text-foreground">
                  Provision Node
                </h3>
                <p className="text-sm text-muted-foreground/70">
                  Tambahkan MikroTik router ke sistem manajemen.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="p-4 md:p-8 space-y-6">

                {/* ── Common Fields ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Nama Router
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="e.g. HQ-Core-CCR2004"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Label (Opsional)
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="e.g. Kantor Cabang"
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Host & Port ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Host / IP Address
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="192.168.88.1 atau host:port"
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      onBlur={handleHostBlur}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Port
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="8728"
                      type="text"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Credentials ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Username
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="admin"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Password
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="Password API router"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* ── Test Connection (now below credentials, tests full login) ── */}
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
                  {testMessage && (
                    <span className={cn(
                      "text-xs",
                      testStatus === "success" ? "text-tertiary" : "text-red-400"
                    )}>
                      {testMessage}
                    </span>
                  )}
                </div>

                {/* ── MikroTik DNS ── */}
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">MikroTik DNS</h4>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      DNS Hotspot <span className="text-muted-foreground/40 normal-case">(Opsional)</span>
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="e.g. toko.net"
                      type="text"
                      value={dnsHotspot}
                      onChange={(e) => setDnsHotspot(e.target.value)}
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
                        Token Bot <span className="text-muted-foreground/40 normal-case">(Opsional)</span>
                      </label>
                      <Input
                        className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                        placeholder="5588663159:AAE..."
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

                {/* ── Default Toggle ── */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground">
                    Jadikan router utama (default)
                  </span>
                  <div
                    className={cn(
                      "w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors",
                      isDefault ? "bg-[#4ae176]/20" : "bg-muted-foreground/20"
                    )}
                    onClick={() => setIsDefault(!isDefault)}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-3 h-3 rounded-full transition-all",
                        isDefault
                          ? "right-1 bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.5)]"
                          : "left-1 bg-muted-foreground/50"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createRouter.isPending}
                  className="bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {createRouter.isPending ? "Menambahkan..." : "Tambah Router"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
