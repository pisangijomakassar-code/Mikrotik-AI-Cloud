"use client"

import { useState } from "react"
import { Cloud, Shield, X, CheckCircle2, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useCreateTunnel } from "@/hooks/use-tunnels"
import { useAuth } from "@/hooks/use-auth"
import { TunnelSetupWizard } from "@/components/tunnel-setup-wizard"
import { TUNNEL_SERVICES } from "@/lib/types/index"
import type { TunnelMethod } from "@/lib/types/index"

interface TunnelActivateDialogProps {
  routerId: string
  routerName: string
  onClose: () => void
}

const METHOD_OPTIONS = [
  {
    value: "CLOUDFLARE" as TunnelMethod,
    icon: <Cloud className="h-4 w-4" />,
    title: "Cloudflare Tunnel",
    description: "Router di balik NAT, mendukung Docker container",
    badge: "RouterOS 7+",
    color: "text-primary border-primary/50 bg-primary/8",
    badgeColor: "bg-primary/10 text-primary",
    features: [
      "Tidak perlu IP publik atau port forwarding",
      "Menggunakan Docker container di RouterOS 7",
      "Cocok untuk RB5009, CCR2004, hEX S, dll",
    ],
  },
  {
    value: "SSTP" as TunnelMethod,
    icon: <Shield className="h-4 w-4" />,
    title: "SSTP VPN",
    description: "Router di balik NAT, SSTP built-in tanpa Docker",
    badge: "RouterOS 6",
    color: "text-amber-400 border-amber-400/50 bg-amber-400/8",
    badgeColor: "bg-amber-400/10 text-amber-400",
    features: [
      "Tidak perlu Docker atau container support",
      "SSTP client built-in di RouterOS 6.x",
      "Cocok untuk RB750, RB951, RB2011, dll",
    ],
  },
]

type Step = "config" | "setup"

// ── Non-admin contact panel ───────────────────────────────────────────────────

function ContactAdminPanel({
  routerName,
  onClose,
}: {
  routerName: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-xl font-headline font-bold text-foreground">Setup Tunnel</h3>
            <p className="text-sm text-muted-foreground/70 mt-0.5">{routerName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1.5">
            <p className="font-headline font-bold text-foreground text-base">
              Hubungi Admin untuk Mengaktifkan
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-xs leading-relaxed">
              Tunnel perlu disetup oleh admin. Setelah aktif, kamu bisa mengelola port dan melihat instruksi setup dari halaman ini.
            </p>
          </div>
          <div className="w-full mt-2 p-3 bg-muted/60 rounded-xl border border-border text-left space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Router</p>
            <p className="text-sm font-mono text-foreground font-semibold">{routerName}</p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-xs font-headline font-bold border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function TunnelActivateDialog({
  routerId,
  routerName,
  onClose,
}: TunnelActivateDialogProps) {
  const { isAdmin } = useAuth()
  const [step, setStep] = useState<Step>("config")
  const [method, setMethod] = useState<TunnelMethod>("CLOUDFLARE")
  const [routerLanIp, setRouterLanIp] = useState("192.168.88.1")
  const [enabledPorts, setEnabledPorts] = useState<string[]>(
    TUNNEL_SERVICES.filter((s) => s.defaultEnabled).map((s) => s.serviceName)
  )

  const createTunnel = useCreateTunnel()

  // Non-admin users cannot provision tunnels — show contact admin panel
  if (!isAdmin) {
    return <ContactAdminPanel routerName={routerName} onClose={onClose} />
  }

  function togglePort(serviceName: string, isRequired: boolean) {
    if (isRequired) return
    setEnabledPorts((prev) =>
      prev.includes(serviceName)
        ? prev.filter((p) => p !== serviceName)
        : [...prev, serviceName]
    )
  }

  function handleActivate() {
    createTunnel.mutate(
      { routerId, method, routerLanIp, enabledPorts },
      {
        onSuccess: () => {
          toast.success("Tunnel berhasil diaktifkan")
          setStep("setup")
        },
        onError: (err) => {
          toast.error(err.message)
        },
      }
    )
  }

  // After tunnel created — show setup wizard
  if (step === "setup") {
    return (
      <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
        <TunnelSetupWizard routerId={routerId} method={method} onClose={onClose} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl font-headline font-bold text-foreground">Aktifkan Tunnel</h3>
            <p className="text-sm text-muted-foreground/70 mt-0.5">{routerName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Method selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
              Metode Tunnel
            </label>
            <div className="grid grid-cols-1 gap-2">
              {METHOD_OPTIONS.map((opt) => {
                const selected = method === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMethod(opt.value)}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                      selected ? opt.color : "border-border bg-muted/40 hover:border-muted-foreground/30"
                    )}
                  >
                    <span className={cn("shrink-0 mt-0.5", selected ? "" : "text-muted-foreground/70")}>
                      {opt.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-bold", selected ? "text-foreground" : "text-muted-foreground")}>
                          {opt.title}
                        </span>
                        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full", opt.badgeColor)}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{opt.description}</p>
                      {selected && (
                        <ul className="mt-2 space-y-1">
                          {opt.features.map((f) => (
                            <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                              <CheckCircle2 className="h-3 w-3 shrink-0 opacity-60" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Router LAN IP */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
              Router LAN IP
            </label>
            <Input
              className="bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
              placeholder="192.168.88.1"
              value={routerLanIp}
              onChange={(e) => setRouterLanIp(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground/70 ml-1">
              IP router di jaringan LAN lokal
            </p>
          </div>

          {/* Port selection (Cloudflare only) */}
          {method === "CLOUDFLARE" && (
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
                        checked ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40",
                        isRequired && "cursor-default opacity-80"
                      )}
                      onClick={() => togglePort(svc.serviceName, isRequired)}
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                          checked ? "bg-primary border-primary" : "border-muted-foreground/50 bg-transparent"
                        )}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="#003640" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-xs text-foreground font-medium flex-1">{svc.label}</span>
                      {isRequired && <span className="text-[10px] text-muted-foreground/70 font-bold">Wajib</span>}
                    </label>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/50 ml-1">
                Port yang diizinkan ditentukan oleh plan pengguna. Port di luar plan akan otomatis dinonaktifkan.
              </p>
            </div>
          )}

          {/* SSTP note */}
          {method === "SSTP" && (
            <div className="p-3 bg-amber-400/5 border border-amber-400/10 rounded-xl">
              <p className="text-[11px] text-amber-400">
                SSTP VPN akan mengaktifkan port sesuai plan pengguna secara otomatis.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-muted/50 border-t border-border flex items-center justify-end gap-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleActivate}
            disabled={createTunnel.isPending}
            className="bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
          >
            {createTunnel.isPending ? "Mengaktifkan..." : "Aktifkan Tunnel"}
          </button>
        </div>
      </div>
    </div>
  )
}
