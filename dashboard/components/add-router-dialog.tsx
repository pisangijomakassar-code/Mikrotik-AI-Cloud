"use client"

import { useState } from "react"
import { PlusCircle, X, Globe, Cloud, Shield } from "lucide-react"
import { useCreateRouter } from "@/hooks/use-routers"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { TunnelSetupWizard } from "@/components/tunnel-setup-wizard"
import { TUNNEL_SERVICES } from "@/lib/types"
import type { ConnectionMethod, TunnelMethod } from "@/lib/types"

// Extended router creation payload (back-end accepts these extra fields)
interface ExtendedCreateRouterInput {
  name: string
  host?: string
  port?: number
  username: string
  password: string
  label?: string
  isDefault?: boolean
  userId: string
  connectionMethod: ConnectionMethod
  tunnelMethod?: TunnelMethod
  routerLanIp?: string
  enabledPorts?: string[]
}

interface CreatedRouterResponse {
  id: string
  name: string
  connectionMethod?: ConnectionMethod
}

// ── Connection Method Option ──────────────────────────────────────────────────

interface MethodOption {
  value: ConnectionMethod | "CLOUDFLARE" | "SSTP"
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
}

const METHOD_OPTIONS: MethodOption[] = [
  {
    value: "DIRECT",
    icon: <Globe className="h-4 w-4" />,
    title: "Direct Connection",
    description: "Router sudah memiliki IP / hostname publik",
  },
  {
    value: "CLOUDFLARE",
    icon: <Cloud className="h-4 w-4" />,
    title: "Cloudflare Tunnel",
    description: "Di balik NAT, router mendukung Docker container",
    badge: "RouterOS 7+",
  },
  {
    value: "SSTP",
    icon: <Shield className="h-4 w-4" />,
    title: "VPN Tunnel / SSTP",
    description: "Di balik NAT, dukungan SSTP built-in",
    badge: "RouterOS 6",
  },
]

// ── Port Checkboxes ───────────────────────────────────────────────────────────

interface PortCheckboxesProps {
  enabledPorts: string[]
  onChange: (ports: string[]) => void
}

function PortCheckboxes({ enabledPorts, onChange }: PortCheckboxesProps) {
  function toggle(serviceName: string, isRequired: boolean) {
    if (isRequired) return
    if (enabledPorts.includes(serviceName)) {
      onChange(enabledPorts.filter((p) => p !== serviceName))
    } else {
      onChange([...enabledPorts, serviceName])
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
        Port yang diaktifkan
      </label>
      <div className="grid grid-cols-1 gap-2">
        {TUNNEL_SERVICES.map((svc) => {
          const isRequired = svc.serviceName === "api"
          const checked = isRequired || enabledPorts.includes(svc.serviceName)

          return (
            <label
              key={svc.serviceName}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                checked
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-muted/40 hover:border-border",
                isRequired && "cursor-default opacity-80"
              )}
              onClick={() => toggle(svc.serviceName, isRequired)}
            >
              {/* Custom checkbox */}
              <span
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                  checked
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/50 bg-transparent"
                )}
              >
                {checked && (
                  <svg
                    width="10"
                    height="8"
                    viewBox="0 0 10 8"
                    fill="none"
                  >
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="#003640"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="text-xs text-foreground font-medium flex-1">
                {svc.label}
              </span>
              {isRequired && (
                <span className="text-[10px] text-muted-foreground/70 font-bold">
                  Wajib
                </span>
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

type DialogStep = "form" | "tunnel-setup"

export function AddRouterDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<DialogStep>("form")

  // Form state — shared
  const [connectionMethod, setConnectionMethod] = useState<
    ConnectionMethod | "CLOUDFLARE" | "SSTP"
  >("DIRECT")
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [label, setLabel] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  // Direct-only fields
  const [host, setHost] = useState("")
  const [port, setPort] = useState("8728")

  // Tunnel-only fields
  const [routerLanIp, setRouterLanIp] = useState("192.168.88.1")
  const [enabledPorts, setEnabledPorts] = useState<string[]>(
    TUNNEL_SERVICES.filter((s) => s.defaultEnabled).map((s) => s.serviceName)
  )

  // After creation
  const [createdRouterId, setCreatedRouterId] = useState<string | null>(null)

  const createRouter = useCreateRouter()

  const isTunnel = connectionMethod !== "DIRECT"
  const tunnelMethod: TunnelMethod | undefined =
    connectionMethod === "CLOUDFLARE"
      ? "CLOUDFLARE"
      : connectionMethod === "SSTP"
      ? "SSTP"
      : undefined

  function resetForm() {
    setStep("form")
    setConnectionMethod("DIRECT")
    setName("")
    setHost("")
    setPort("8728")
    setUsername("")
    setPassword("")
    setLabel("")
    setIsDefault(false)
    setRouterLanIp("192.168.88.1")
    setEnabledPorts(
      TUNNEL_SERVICES.filter((s) => s.defaultEnabled).map((s) => s.serviceName)
    )
    setCreatedRouterId(null)
  }

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !username.trim() || !password) {
      toast.error("Nama, username, dan password wajib diisi")
      return
    }

    if (!isTunnel && !host.trim()) {
      toast.error("Host / IP wajib diisi untuk Direct Connection")
      return
    }

    const payload: ExtendedCreateRouterInput = {
      name: name.trim(),
      username: username.trim(),
      password,
      label: label.trim() || undefined,
      isDefault,
      userId: "",
      connectionMethod: isTunnel ? "TUNNEL" : "DIRECT",
      ...(isTunnel
        ? {
            tunnelMethod,
            routerLanIp: routerLanIp.trim() || "192.168.88.1",
            enabledPorts,
          }
        : {
            host: host.trim(),
            port: parseInt(port) || 8728,
          }),
    }

    createRouter.mutate(payload as Parameters<typeof createRouter.mutate>[0], {
      onSuccess: (data) => {
        const response = data as CreatedRouterResponse
        if (isTunnel && response?.id) {
          setCreatedRouterId(response.id)
          setStep("tunnel-setup")
          toast.success("Router dibuat. Ikuti instruksi setup tunnel.")
        } else {
          toast.success("Router berhasil ditambahkan")
          resetForm()
          setOpen(false)
        }
      },
      onError: (err) => {
        toast.error(err.message)
      },
    })
  }

  // ── Render: Tunnel Setup Step ─────────────────────────────────────────────

  if (open && step === "tunnel-setup" && createdRouterId && tunnelMethod) {
    return (
      <TunnelSetupWizard
        routerId={createdRouterId}
        method={tunnelMethod}
        onClose={handleClose}
      />
    )
  }

  // ── Render: Trigger + Form Modal ──────────────────────────────────────────

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
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

                {/* ── Connection Method ── */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Metode Koneksi
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {METHOD_OPTIONS.map((opt) => {
                      const selected = connectionMethod === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setConnectionMethod(opt.value as typeof connectionMethod)}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                            selected
                              ? "border-primary/50 bg-primary/8"
                              : "border-border bg-muted/40 hover:border-border"
                          )}
                        >
                          {/* Radio dot */}
                          <span
                            className={cn(
                              "w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-all flex items-center justify-center",
                              selected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/50"
                            )}
                          >
                            {selected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#003640]" />
                            )}
                          </span>

                          {/* Icon + text */}
                          <span
                            className={cn(
                              "shrink-0 mt-0.5",
                              selected ? "text-primary" : "text-muted-foreground/70"
                            )}
                          >
                            {opt.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-sm font-bold",
                                  selected ? "text-foreground" : "text-muted-foreground"
                                )}
                              >
                                {opt.title}
                              </span>
                              {opt.badge && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                              {opt.description}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

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

                {/* ── Direct Connection Fields ── */}
                {!isTunnel && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                        Host / IP Address
                      </label>
                      <Input
                        className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                        placeholder="192.168.88.1"
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        required={!isTunnel}
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
                )}

                {/* ── Tunnel Fields ── */}
                {isTunnel && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Router LAN IP
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="e.g. 192.168.88.1"
                      type="text"
                      value={routerLanIp}
                      onChange={(e) => setRouterLanIp(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground/70 ml-1">
                      IP router di jaringan LAN lokal (biasanya 192.168.88.1)
                    </p>
                  </div>
                )}

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

                {/* ── Port Selection (Cloudflare only) ── */}
                {connectionMethod === "CLOUDFLARE" && (
                  <PortCheckboxes
                    enabledPorts={enabledPorts}
                    onChange={setEnabledPorts}
                  />
                )}

                {/* ── SSTP note ── */}
                {connectionMethod === "SSTP" && (
                  <div className="p-3 bg-amber-400/5 border border-amber-400/10 rounded-xl">
                    <p className="text-[11px] text-amber-400">
                      SSTP VPN akan membuka semua port yang tersedia melalui IP yang ditetapkan.
                    </p>
                  </div>
                )}

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
                  className="bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {createRouter.isPending
                    ? isTunnel
                      ? "Membuat tunnel..."
                      : "Menambahkan..."
                    : isTunnel
                    ? "Buat & Setup Tunnel"
                    : "Tambah Router"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
