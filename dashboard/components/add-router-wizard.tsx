"use client"

import { useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  PlusCircle,
  X,
  ArrowLeft,
  ArrowRight,
  Globe,
  Lock,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  Info,
  ChevronDown,
  HelpCircle,
  Cloud,
  Shield,
  Network,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useCreateRouter, useRouters } from "@/hooks/use-routers"
import { useCreateTunnel } from "@/hooks/use-tunnels"
import { usePlan } from "@/hooks/use-plan"
import { PLAN_LIMITS } from "@/lib/constants/plan-limits"
import { TUNNEL_SERVICES } from "@/lib/types"
import type { TunnelMethod } from "@/lib/types"
import { TunnelSetupWizard } from "@/components/tunnel-setup-wizard"

type ConnectivityPath = "PUBLIC" | "TUNNEL"

type WizardStep =
  | "prereq"
  | "method"
  | "details-public"
  | "details-tunnel"
  | "tunnel-config"
  | "tunnel-script"
  | "done"

const TUNNEL_METHOD_OPTIONS: {
  value: TunnelMethod
  icon: React.ReactNode
  title: string
  description: string
  badge: string
}[] = [
  {
    value: "CLOUDFLARE",
    icon: <Cloud className="h-4 w-4" />,
    title: "Cloudflare",
    description: "Zero-config, paling stabil. Butuh Docker container di RouterOS 7+",
    badge: "Direkomendasi",
  },
  {
    value: "SSTP",
    icon: <Shield className="h-4 w-4" />,
    title: "SSTP",
    description: "Built-in di semua RouterOS. Tidak perlu install apapun",
    badge: "Built-in",
  },
  {
    value: "OVPN",
    icon: <Network className="h-4 w-4" />,
    title: "OpenVPN",
    description: "Performa lebih baik dari SSTP, kompatibel RouterOS 6+",
    badge: "Stabil",
  },
  {
    value: "WIREGUARD",
    icon: <Sparkles className="h-4 w-4" />,
    title: "WireGuard",
    description: "Paling cepat. RouterOS 7+ saja",
    badge: "RouterOS 7+",
  },
]

export function AddRouterWizard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>("prereq")
  const [path, setPath] = useState<ConnectivityPath | null>(null)
  const { data: session } = useSession()
  const { data: plan = "FREE" } = usePlan()
  const { data: routersData } = useRouters()
  const planLimits = PLAN_LIMITS[plan]
  const slotUsed = routersData?.length ?? 0
  const slotMax = planLimits.maxRouters
  const slotFull = slotUsed >= slotMax

  // Form state
  const [name, setName] = useState("")
  const [label, setLabel] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [host, setHost] = useState("")
  const [port, setPort] = useState("8728")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [tunnelMethod, setTunnelMethod] = useState<TunnelMethod>("CLOUDFLARE")
  const [routerLanIp, setRouterLanIp] = useState("192.168.88.1")
  const [enabledPorts, setEnabledPorts] = useState<string[]>(["api", "winbox"])

  // Test connection state (Path A only)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle")
  const [testMessage, setTestMessage] = useState("")

  // Created router id (after Path B step 2)
  const [createdRouterId, setCreatedRouterId] = useState<string | null>(null)

  const createRouter = useCreateRouter()
  const createTunnel = useCreateTunnel()

  const allowedPorts = planLimits.allowedTunnelPorts
  const allowedTunnelServices = useMemo(
    () => TUNNEL_SERVICES.filter((s) => allowedPorts.includes(s.serviceName)),
    [allowedPorts],
  )

  function reset() {
    setStep("prereq")
    setPath(null)
    setName("")
    setLabel("")
    setIsDefault(false)
    setHost("")
    setPort("8728")
    setUsername("")
    setPassword("")
    setTunnelMethod("CLOUDFLARE")
    setRouterLanIp("192.168.88.1")
    setEnabledPorts(["api", "winbox"])
    setTestStatus("idle")
    setTestMessage("")
    setCreatedRouterId(null)
  }

  function handleClose() {
    setOpen(false)
    setTimeout(reset, 300)
  }

  function togglePort(serviceName: string) {
    if (serviceName === "api") return // wajib
    setEnabledPorts((prev) =>
      prev.includes(serviceName)
        ? prev.filter((p) => p !== serviceName)
        : [...prev, serviceName],
    )
  }

  async function handleTestConnection() {
    if (!host.trim() || !username.trim() || !password) {
      toast.error("Isi host, username, password dulu")
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
          port: parseInt(port) || 8728,
          username: username.trim(),
          password,
        }),
      })
      const data = await res.json()
      // API selalu return HTTP 200 dgn body {success:bool, message:str}.
      // Cek field success — bukan res.ok.
      if (res.ok && data.success === true) {
        setTestStatus("success")
        setTestMessage(data.message ?? "Terhubung")
      } else {
        setTestStatus("failed")
        setTestMessage(data.message ?? data.error ?? "Gagal koneksi")
      }
    } catch (err) {
      setTestStatus("failed")
      setTestMessage(err instanceof Error ? err.message : "Gagal koneksi")
    }
  }

  function handleSavePublic() {
    if (!name.trim() || !host.trim() || !username.trim() || !password) {
      toast.error("Lengkapi semua field wajib")
      return
    }
    if (testStatus !== "success") {
      toast.error("Test koneksi harus berhasil dulu")
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
        userId: session?.user?.id ?? "",
      },
      {
        onSuccess: () => {
          toast.success("Router berhasil ditambah")
          setStep("done")
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  async function handleSaveTunnelDetails() {
    if (!name.trim() || !username.trim() || !password) {
      toast.error("Nama, username, password wajib diisi")
      return
    }
    // Path B — buat Router dulu (placeholder host pakai LAN IP), tunnel di step berikut
    createRouter.mutate(
      {
        name: name.trim(),
        host: routerLanIp || "192.168.88.1",
        port: parseInt(port) || 8728,
        username: username.trim(),
        password,
        label: label.trim() || undefined,
        isDefault,
        userId: session?.user?.id ?? "",
      },
      {
        onSuccess: (router) => {
          const r = router as { id?: string } | null
          if (!r?.id) {
            toast.error("Router dibuat tapi ID tidak diterima")
            return
          }
          setCreatedRouterId(r.id)
          setStep("tunnel-config")
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function handleCreateTunnel() {
    if (!createdRouterId) {
      toast.error("Router ID belum tersedia")
      return
    }
    createTunnel.mutate(
      {
        routerId: createdRouterId,
        method: tunnelMethod,
        routerLanIp: routerLanIp || "192.168.88.1",
        enabledPorts,
      },
      {
        onSuccess: () => {
          toast.success("Tunnel dibuat. Salin script ke MikroTik.")
          setStep("tunnel-script")
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => slotFull ? toast.error(`Slot penuh (${slotUsed}/${slotMax}). Upgrade plan untuk tambah router lagi.`) : setOpen(true)}
        disabled={slotFull}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all duration-200",
          slotFull
            ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
            : "bg-linear-to-br from-primary to-primary-container text-primary-foreground shadow-primary/20 hover:scale-105",
        )}
        title={slotFull ? `Slot penuh ${slotUsed}/${slotMax}` : "Tambah router baru"}
      >
        <PlusCircle className="h-4 w-4" />
        Tambah Router
      </button>

      {!open && null}

      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="w-full max-w-2xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div>
                  <h3 className="text-xl font-headline font-bold text-foreground">
                    Tambah Router Baru
                  </h3>
                  <p className="text-xs text-muted-foreground/70">
                    Slot {slotUsed + (step === "done" ? 0 : 1)} / {slotMax} · Plan{" "}
                    <span className={planLimits.color}>{planLimits.label}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StepIndicator step={step} path={path} />
                <button onClick={handleClose} className="text-muted-foreground/70 hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {step === "prereq" && (
                <PrereqStep onNext={() => setStep("method")} onCancel={handleClose} />
              )}

              {step === "method" && (
                <MethodStep
                  onPick={(p) => {
                    setPath(p)
                    setStep(p === "PUBLIC" ? "details-public" : "details-tunnel")
                  }}
                  onBack={() => setStep("prereq")}
                />
              )}

              {step === "details-public" && (
                <PublicDetailsStep
                  name={name} setName={setName}
                  label={label} setLabel={setLabel}
                  host={host} setHost={setHost}
                  port={port} setPort={setPort}
                  username={username} setUsername={setUsername}
                  password={password} setPassword={setPassword}
                  isDefault={isDefault} setIsDefault={setIsDefault}
                  testStatus={testStatus}
                  testMessage={testMessage}
                  onTest={handleTestConnection}
                  onBack={() => setStep("method")}
                  onSave={handleSavePublic}
                  saving={createRouter.isPending}
                />
              )}

              {step === "details-tunnel" && (
                <TunnelDetailsStep
                  name={name} setName={setName}
                  label={label} setLabel={setLabel}
                  username={username} setUsername={setUsername}
                  password={password} setPassword={setPassword}
                  port={port} setPort={setPort}
                  isDefault={isDefault} setIsDefault={setIsDefault}
                  onBack={() => setStep("method")}
                  onNext={handleSaveTunnelDetails}
                  saving={createRouter.isPending}
                />
              )}

              {step === "tunnel-config" && createdRouterId && (
                <TunnelConfigStep
                  tunnelMethod={tunnelMethod} setTunnelMethod={setTunnelMethod}
                  routerLanIp={routerLanIp} setRouterLanIp={setRouterLanIp}
                  enabledPorts={enabledPorts} togglePort={togglePort}
                  allowedServices={allowedTunnelServices}
                  planLabel={planLimits.label}
                  onBack={() => setStep("details-tunnel")}
                  onCreate={handleCreateTunnel}
                  creating={createTunnel.isPending}
                />
              )}

              {step === "tunnel-script" && createdRouterId && (
                <div className="p-6">
                  <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/15 flex items-start gap-2">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Tunnel sudah dibuat di server.</strong>{" "}
                      Sekarang paste script ke Terminal MikroTik. Sistem auto-detect saat tunnel
                      sudah konek.
                    </p>
                  </div>
                  <TunnelSetupWizard
                    routerId={createdRouterId}
                    method={tunnelMethod}
                    embedded
                    onClose={() => setStep("done")}
                  />
                </div>
              )}

              {step === "done" && (
                <DoneStep onClose={handleClose} routerName={name} path={path} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Step components ─────────────────────────────────────────────────────────

function StepIndicator({ step, path }: { step: WizardStep; path: ConnectivityPath | null }) {
  const stepsOrder =
    path === "PUBLIC"
      ? ["prereq", "method", "details-public", "done"]
      : path === "TUNNEL"
        ? ["prereq", "method", "details-tunnel", "tunnel-config", "tunnel-script", "done"]
        : ["prereq", "method"]
  const idx = stepsOrder.indexOf(step)
  const total = stepsOrder.length
  if (idx < 0 || step === "done") return null
  return (
    <div className="hidden sm:flex items-center gap-1">
      {stepsOrder.slice(0, -1).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i <= idx ? "bg-primary w-8" : "bg-muted w-3",
          )}
        />
      ))}
      <span className="text-[10px] text-muted-foreground/70 ml-2 font-mono">
        {idx + 1}/{total - 1}
      </span>
    </div>
  )
}

function PrereqStep({ onNext, onCancel }: { onNext: () => void; onCancel: () => void }) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h4 className="text-base font-bold text-foreground mb-1">Sebelum mulai — pastikan</h4>
        <p className="text-xs text-muted-foreground/70">
          3 hal ini wajib ada di sisi router supaya wizard bisa selesai.
        </p>
      </div>
      <ul className="space-y-3">
        {[
          {
            t: "Router punya internet",
            d: "Tunnel client (Cloudflare/SSTP/OVPN/WireGuard) butuh koneksi keluar untuk konek balik ke server. Cek di MikroTik: /tool fetch url=https://1.1.1.1 mode=https",
          },
          {
            t: "Akses Winbox / WebFig / Terminal SSH ke router",
            d: "Untuk paste script konfigurasi tunnel sekali di awal. Setelahnya bisa remote via tunnel.",
          },
          {
            t: "Username & password admin RouterOS",
            d: "Akun yang punya akses penuh untuk tambah interface, firewall NAT, dan scheduler. Boleh akun api-only juga.",
          },
        ].map((item) => (
          <li key={item.t} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
            <CheckCircle2 className="h-5 w-5 text-tertiary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{item.t}</p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed mt-0.5">{item.d}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Batal
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform"
        >
          Lanjut <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function MethodStep({
  onPick, onBack,
}: { onPick: (p: ConnectivityPath) => void; onBack: () => void }) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h4 className="text-base font-bold text-foreground mb-1">Bagaimana router Anda terhubung?</h4>
        <p className="text-xs text-muted-foreground/70">Pilih satu — bisa diubah dengan hapus &amp; tambah ulang.</p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <PathCard
          icon={<Globe className="h-5 w-5" />}
          title="Punya IP publik / DDNS / port forward"
          desc="Router bisa diakses langsung dari VPS. Cocok kalau IP statis ISP, sudah setup DDNS sendiri, atau port 8728 sudah di-forward di modem."
          onClick={() => onPick("PUBLIC")}
        />
        <PathCard
          icon={<Lock className="h-5 w-5" />}
          title="Di balik NAT — perlu Tunnel"
          desc="Router di rumah/kantor tanpa IP publik. Sistem buat tunnel otomatis, kamu paste 1 script ke MikroTik. Selesai."
          recommended
          onClick={() => onPick("TUNNEL")}
        />
      </div>
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
      </div>
    </div>
  )
}

function PathCard({
  icon, title, desc, recommended, onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl border border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/5 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-primary group-hover:bg-primary/10 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground">{title}</p>
            {recommended && (
              <span className="text-[9px] uppercase tracking-widest font-black text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded-full">
                Direkomendasikan
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed mt-1">{desc}</p>
        </div>
      </div>
    </button>
  )
}

function PublicDetailsStep(props: {
  name: string; setName: (v: string) => void
  label: string; setLabel: (v: string) => void
  host: string; setHost: (v: string) => void
  port: string; setPort: (v: string) => void
  username: string; setUsername: (v: string) => void
  password: string; setPassword: (v: string) => void
  isDefault: boolean; setIsDefault: (v: boolean) => void
  testStatus: "idle" | "testing" | "success" | "failed"
  testMessage: string
  onTest: () => void
  onBack: () => void
  onSave: () => void
  saving: boolean
}) {
  const {
    name, setName, label, setLabel, host, setHost, port, setPort,
    username, setUsername, password, setPassword, isDefault, setIsDefault,
    testStatus, testMessage, onTest, onBack, onSave, saving,
  } = props

  const fieldClass = "w-full bg-muted border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"

  return (
    <div className="p-6 space-y-4">
      <h4 className="text-base font-bold text-foreground">Detail router (akses langsung)</h4>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Nama Router *</label>
          <Input className={fieldClass} placeholder="HQ-Core" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Label</label>
          <Input className={fieldClass} placeholder="Kantor pusat" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className={labelClass}>Host / IP / DDNS *</label>
          <Input className={cn(fieldClass, "font-mono-tech")} placeholder="ddns.example.com atau 1.2.3.4" value={host} onChange={(e) => setHost(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Port API *</label>
          <Input className={cn(fieldClass, "font-mono-tech")} placeholder="8728" value={port} onChange={(e) => setPort(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Username MikroTik *</label>
          <Input className={fieldClass} placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Password *</label>
          <Input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-primary" />
        Set sebagai router default (dipakai bot Telegram tanpa parameter router)
      </label>

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button
          type="button"
          onClick={onTest}
          disabled={testStatus === "testing" || !host.trim() || !username.trim() || !password}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-all disabled:opacity-50"
        >
          {testStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" />
            : testStatus === "success" ? <Wifi className="h-4 w-4 text-tertiary" />
            : testStatus === "failed" ? <WifiOff className="h-4 w-4 text-destructive" />
            : <Wifi className="h-4 w-4" />}
          {testStatus === "testing" ? "Mengecek..." : "Test Koneksi"}
        </button>
        {testMessage && (
          <span className={cn("text-xs", testStatus === "success" ? "text-tertiary" : "text-destructive")}>
            {testMessage}
          </span>
        )}
      </div>

      <div className="flex justify-between pt-3 border-t border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
        <button
          onClick={onSave}
          disabled={saving || testStatus !== "success"}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Simpan
        </button>
      </div>
    </div>
  )
}

function TunnelDetailsStep(props: {
  name: string; setName: (v: string) => void
  label: string; setLabel: (v: string) => void
  username: string; setUsername: (v: string) => void
  password: string; setPassword: (v: string) => void
  port: string; setPort: (v: string) => void
  isDefault: boolean; setIsDefault: (v: boolean) => void
  onBack: () => void
  onNext: () => void
  saving: boolean
}) {
  const {
    name, setName, label, setLabel, username, setUsername, password, setPassword,
    port, setPort, isDefault, setIsDefault, onBack, onNext, saving,
  } = props
  const fieldClass = "w-full bg-muted border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"

  return (
    <div className="p-6 space-y-4">
      <h4 className="text-base font-bold text-foreground">Detail router & akses MikroTik</h4>
      <p className="text-xs text-muted-foreground/70">
        Test koneksi dilakukan otomatis lewat tunnel di langkah berikutnya.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Nama Router *</label>
          <Input className={fieldClass} placeholder="HQ-Core" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Label</label>
          <Input className={fieldClass} placeholder="Kantor cabang" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Kredensial MikroTik</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Username admin/api *</label>
            <Input className={fieldClass} placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Password *</label>
            <Input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5 mt-3">
          <label className={labelClass}>Port API (default 8728)</label>
          <Input className={cn(fieldClass, "font-mono-tech max-w-32")} placeholder="8728" value={port} onChange={(e) => setPort(e.target.value)} />
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-2">
          Disimpan terenkripsi. Sistem akan pakai untuk konek via tunnel setelah aktif.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-primary" />
        Set sebagai router default
      </label>

      <div className="flex justify-between pt-3 border-t border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
        <button
          onClick={onNext}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Lanjut Setup Tunnel
        </button>
      </div>
    </div>
  )
}

function TunnelConfigStep(props: {
  tunnelMethod: TunnelMethod
  setTunnelMethod: (m: TunnelMethod) => void
  routerLanIp: string
  setRouterLanIp: (v: string) => void
  enabledPorts: string[]
  togglePort: (n: string) => void
  allowedServices: typeof TUNNEL_SERVICES
  planLabel: string
  onBack: () => void
  onCreate: () => void
  creating: boolean
}) {
  const {
    tunnelMethod, setTunnelMethod, routerLanIp, setRouterLanIp,
    enabledPorts, togglePort, allowedServices, planLabel,
    onBack, onCreate, creating,
  } = props
  const fieldClass = "w-full bg-muted border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"

  return (
    <div className="p-6 space-y-5">
      <h4 className="text-base font-bold text-foreground">Pilih metode tunnel</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TUNNEL_METHOD_OPTIONS.map((opt) => {
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
                <span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/60 ml-auto">
                  {opt.badge}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{opt.description}</p>
            </button>
          )
        })}
      </div>

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
            <p><strong className="text-foreground">B. Dari laptop yang konek:</strong> Windows <code>ipconfig</code> → Default Gateway. Mac/Linux <code>ip route | grep default</code></p>
            <p><strong className="text-foreground">C. Fresh install:</strong> default <code className="text-primary">192.168.88.1</code></p>
            <p><strong className="text-foreground">D. Topologi modem ISP (Indihome dsb):</strong> isi IP <em>LAN MikroTik</em> (gateway laptop), <strong>bukan</strong> IP modem (192.168.1.1) atau IP WAN MikroTik.</p>
          </div>
        </details>
      </div>

      <div className="space-y-2">
        <label className={labelClass}>Port yang diaktifkan (Plan {planLabel})</label>
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
                  isAllowed && (checked
                    ? "border-primary/30 bg-primary/5 cursor-pointer"
                    : "border-border bg-muted/40 cursor-pointer"),
                )}
                onClick={() => isAllowed && !isRequired && togglePort(svc.serviceName)}
              >
                <span className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  checked ? "bg-primary border-primary" : "border-muted-foreground/50",
                )}>
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
                {!isAllowed && <span className="text-[9px] uppercase font-black text-muted-foreground/50">Plan {planLabel}—</span>}
              </label>
            )
          })}
        </div>
      </div>

      <div className="flex justify-between pt-3 border-t border-border">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
        <button
          onClick={onCreate}
          disabled={creating || !routerLanIp.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Generate Tunnel
        </button>
      </div>
    </div>
  )
}

function DoneStep({ onClose, routerName, path }: { onClose: () => void; routerName: string; path: ConnectivityPath | null }) {
  return (
    <div className="p-8 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-tertiary/10 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-tertiary" />
      </div>
      <div>
        <h4 className="text-lg font-bold text-foreground">Router siap dipakai</h4>
        <p className="text-sm text-muted-foreground/80 mt-1">
          <strong className="text-foreground">{routerName}</strong> sudah terdaftar
          {path === "TUNNEL" && " dengan tunnel aktif"}.
        </p>
      </div>
      <div className="text-xs text-muted-foreground/70 max-w-md mx-auto">
        Cek status real-time di menu <strong className="text-foreground">Routers</strong>,
        atau buka <strong className="text-foreground">Hotspot</strong> untuk mulai generate
        voucher.
      </div>
      <button
        onClick={onClose}
        className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform"
      >
        Selesai
      </button>
    </div>
  )
}
