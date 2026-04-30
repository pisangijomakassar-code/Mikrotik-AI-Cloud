"use client"

import { useState, useMemo } from "react"
import { Network, X, ArrowRight, Loader2, Cloud, Shield, Sparkles, Info } from "lucide-react"
import { HelpCircle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useCreateTunnel } from "@/hooks/use-tunnels"
import { usePlan } from "@/hooks/use-plan"
import { PLAN_LIMITS } from "@/lib/constants/plan-limits"
import { TUNNEL_SERVICES } from "@/lib/types"
import type { TunnelMethod } from "@/lib/types"
import { TunnelSetupWizard } from "@/components/tunnel-setup-wizard"

const METHOD_OPTIONS: { value: TunnelMethod; icon: React.ReactNode; title: string; desc: string; badge: string }[] = [
  { value: "CLOUDFLARE", icon: <Cloud className="h-4 w-4" />, title: "Cloudflare", desc: "Zero-config, paling stabil. Butuh Docker di RouterOS 7+", badge: "Direkomendasi" },
  { value: "SSTP",       icon: <Shield className="h-4 w-4" />, title: "SSTP",       desc: "Built-in semua RouterOS, tanpa install tambahan", badge: "Built-in" },
  { value: "OVPN",       icon: <Network className="h-4 w-4" />, title: "OpenVPN",   desc: "File .ovpn di-generate, RouterOS 6+", badge: "Stabil" },
  { value: "WIREGUARD",  icon: <Sparkles className="h-4 w-4" />, title: "WireGuard", desc: "Paling cepat, RouterOS 7+ saja", badge: "RouterOS 7+" },
]

interface Props {
  routerId: string
  routerName: string
  routerLanIpDefault?: string
}

type Step = "config" | "script" | "done"

export function AddTunnelDialog({ routerId, routerName, routerLanIpDefault = "192.168.88.1" }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("config")
  const [tunnelMethod, setTunnelMethod] = useState<TunnelMethod>("CLOUDFLARE")
  const [routerLanIp, setRouterLanIp] = useState(routerLanIpDefault)
  const [enabledPorts, setEnabledPorts] = useState<string[]>(["api", "winbox"])

  const { data: plan = "FREE" } = usePlan()
  const planLimits = PLAN_LIMITS[plan]
  const allowedServices = useMemo(
    () => TUNNEL_SERVICES.filter((s) => planLimits.allowedTunnelPorts.includes(s.serviceName)),
    [planLimits],
  )

  const createTunnel = useCreateTunnel()

  const fieldClass = "w-full bg-muted border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"

  function togglePort(sn: string) {
    if (sn === "api") return
    setEnabledPorts((prev) => prev.includes(sn) ? prev.filter((p) => p !== sn) : [...prev, sn])
  }

  function handleClose() {
    setOpen(false)
    setTimeout(() => {
      setStep("config")
      setTunnelMethod("CLOUDFLARE")
      setRouterLanIp(routerLanIpDefault)
      setEnabledPorts(["api", "winbox"])
    }, 300)
  }

  function handleCreate() {
    if (!routerLanIp.trim()) {
      toast.error("IP LAN router wajib diisi")
      return
    }
    createTunnel.mutate(
      { routerId, method: tunnelMethod, routerLanIp, enabledPorts },
      {
        onSuccess: () => {
          toast.success("Tunnel dibuat. Salin script ke MikroTik.")
          setStep("script")
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-bold hover:bg-primary/10 transition-colors"
        title="Setup tunnel untuk router ini"
      >
        <Network className="h-3.5 w-3.5" />
        Setup Tunnel
      </button>

      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="w-full max-w-xl mx-4 bg-card border border-border rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-headline font-bold text-foreground">Setup Tunnel</h3>
                <p className="text-xs text-muted-foreground/70">Router: <span className="text-foreground font-semibold">{routerName}</span></p>
              </div>
              <button onClick={handleClose} className="text-muted-foreground/70 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {step === "config" && (
                <>
                  {/* Method picker */}
                  <div className="grid grid-cols-2 gap-2">
                    {METHOD_OPTIONS.map((opt) => {
                      const active = tunnelMethod === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setTunnelMethod(opt.value)}
                          className={cn(
                            "text-left p-3 rounded-xl border transition-all",
                            active ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-primary/30",
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={active ? "text-primary" : "text-muted-foreground/70"}>{opt.icon}</span>
                            <span className="text-sm font-bold text-foreground">{opt.title}</span>
                            <span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/60 ml-auto">{opt.badge}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{opt.desc}</p>
                        </button>
                      )
                    })}
                  </div>

                  {/* LAN IP */}
                  <div className="space-y-1.5">
                    <label className={labelClass}>Router LAN IP *</label>
                    <Input
                      className={cn(fieldClass, "font-mono-tech")}
                      placeholder="192.168.88.1"
                      value={routerLanIp}
                      onChange={(e) => setRouterLanIp(e.target.value)}
                    />
                    <details className="group rounded-lg border border-border bg-muted/30 mt-1">
                      <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors list-none">
                        <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Belum tahu IP router? Cara ceknya</span>
                        <ChevronDown className="h-3.5 w-3.5 ml-auto group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="px-4 pb-3 pt-1 text-xs text-muted-foreground/90 space-y-2 leading-relaxed">
                        <p><strong className="text-foreground">A. Winbox terminal:</strong> <code className="text-primary">/ip address print where interface=bridge</code></p>
                        <p><strong className="text-foreground">B. Dari laptop yang konek:</strong> Windows <code>ipconfig</code> → Default Gateway</p>
                        <p><strong className="text-foreground">C. Fresh install:</strong> default <code className="text-primary">192.168.88.1</code></p>
                        <p><strong className="text-foreground">D. Modem ISP:</strong> IP LAN MikroTik (gateway laptop), bukan IP modem</p>
                      </div>
                    </details>
                  </div>

                  {/* Port checkboxes */}
                  <div className="space-y-2">
                    <label className={labelClass}>Port yang diaktifkan (Plan {planLimits.label})</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {TUNNEL_SERVICES.map((svc) => {
                        const isAllowed = allowedServices.some((a) => a.serviceName === svc.serviceName)
                        const isRequired = svc.serviceName === "api"
                        const checked = isRequired || (isAllowed && enabledPorts.includes(svc.serviceName))
                        return (
                          <label
                            key={svc.serviceName}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                              !isAllowed && "opacity-40 cursor-not-allowed",
                              isAllowed && (checked ? "border-primary/30 bg-primary/5 cursor-pointer" : "border-border bg-muted/40 cursor-pointer"),
                            )}
                            onClick={() => isAllowed && !isRequired && togglePort(svc.serviceName)}
                          >
                            <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", checked ? "bg-primary border-primary" : "border-muted-foreground/50")}>
                              {checked && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="#003640" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{svc.label}</p>
                              <p className="text-[10px] text-muted-foreground/70 font-mono-tech">port {svc.remotePort}</p>
                            </div>
                            {isRequired && <span className="text-[9px] uppercase font-black text-primary">Wajib</span>}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleCreate}
                      disabled={createTunnel.isPending || !routerLanIp.trim()}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {createTunnel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Generate Tunnel
                    </button>
                  </div>
                </>
              )}

              {step === "script" && (
                <>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 flex items-start gap-2">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Tunnel sudah dibuat di server.</strong>{" "}
                      Paste script ke Terminal MikroTik. Sistem auto-detect saat tunnel konek.
                    </p>
                  </div>
                  <TunnelSetupWizard
                    routerId={routerId}
                    method={tunnelMethod}
                    embedded
                    onClose={() => setStep("done")}
                  />
                </>
              )}

              {step === "done" && (
                <div className="py-8 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-tertiary/10 flex items-center justify-center">
                    <Network className="h-7 w-7 text-tertiary" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">Tunnel aktif</h4>
                    <p className="text-sm text-muted-foreground/80 mt-1">Router <strong className="text-foreground">{routerName}</strong> terhubung via tunnel.</p>
                  </div>
                  <button onClick={handleClose} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform">
                    Selesai
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
