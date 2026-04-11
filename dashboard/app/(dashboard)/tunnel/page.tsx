"use client"

import { useState } from "react"
import {
  Cable,
  Cloud,
  Shield,
  CheckCircle2,
  Router,
  AlertCircle,
  Loader2,
  Network,
  Zap,
} from "lucide-react"
import { useTunnels } from "@/hooks/use-tunnels"
import { useRouters } from "@/hooks/use-routers"
import { TunnelStatusBadge } from "@/components/tunnel-status-badge"
import { TunnelManageDialog } from "@/components/tunnel-manage-dialog"
import { TunnelActivateDialog } from "@/components/tunnel-activate-dialog"
import type { TunnelStatus, TunnelMethod } from "@/lib/types/index"

// ── Guide Step ────────────────────────────────────────────────────────────────

function GuideStep({
  step,
  title,
  description,
}: {
  step: number
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {step}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// ── Router Tunnel Row ─────────────────────────────────────────────────────────

interface RouterWithTunnel {
  id: string
  name: string
  label?: string | null
  connectionMethod?: string
  tunnel?: {
    status: TunnelStatus
    method: TunnelMethod
  } | null
}

function RouterTunnelRow({ router }: { router: RouterWithTunnel }) {
  const [activating, setActivating] = useState(false)
  const hasTunnel = router.connectionMethod === "TUNNEL"

  return (
    <>
      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border hover:border-muted-foreground/20 transition-all">
        <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
          <Router className="h-4 w-4 text-muted-foreground/70" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{router.name}</p>
          {router.label && (
            <p className="text-[11px] text-muted-foreground/60 truncate">{router.label}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasTunnel && router.tunnel ? (
            <>
              <TunnelStatusBadge
                status={router.tunnel.status}
                method={router.tunnel.method}
                showMethod
              />
              <TunnelManageDialog
                routerId={router.id}
                routerName={router.name}
                tunnelMethod={router.tunnel.method}
                tunnelStatus={router.tunnel.status}
              />
            </>
          ) : (
            <>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold">
                No Tunnel
              </span>
              <button
                onClick={() => setActivating(true)}
                className="text-[11px] font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-all"
              >
                Aktifkan
              </button>
            </>
          )}
        </div>
      </div>

      {activating && (
        <TunnelActivateDialog
          routerId={router.id}
          routerName={router.name}
          onClose={() => setActivating(false)}
        />
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TunnelPage() {
  const routersQuery = useRouters()
  const tunnelsQuery = useTunnels()

  const isLoading = routersQuery.isLoading || tunnelsQuery.isLoading

  // Merge tunnel data into router list
  const routers: RouterWithTunnel[] = (routersQuery.data ?? []).map((r) => {
    const tunnel = tunnelsQuery.data?.find((t) => t.routerId === r.id)
    return {
      id: r.id,
      name: r.name,
      label: r.label,
      connectionMethod: (r as { connectionMethod?: string }).connectionMethod,
      tunnel: tunnel
        ? { status: tunnel.status as TunnelStatus, method: tunnel.method as TunnelMethod }
        : null,
    }
  })

  const tunnelCount = routers.filter((r) => r.connectionMethod === "TUNNEL").length
  const connectedCount = routers.filter(
    (r) => r.tunnel?.status === "CONNECTED"
  ).length

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight">
              Tunnel
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
              Add-on
            </span>
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            <Cable className="h-[18px] w-[18px] text-primary shrink-0" />
            Koneksi aman untuk router di balik NAT — tanpa IP publik.
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-headline font-bold text-foreground">{tunnelCount}</p>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">Tunnel Aktif</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-right">
            <p className="text-2xl font-headline font-bold text-[#4ae176]">{connectedCount}</p>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">Terhubung</p>
          </div>
        </div>
      </div>

      {/* ── Method Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cloudflare */}
        <div className="card-glass rounded-2xl border border-primary/20 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-foreground">Cloudflare Tunnel</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                RouterOS 7+
              </span>
            </div>
          </div>
          <ul className="space-y-2">
            {[
              "Tidak memerlukan IP publik atau port forwarding",
              "Menggunakan Docker container di RouterOS 7",
              "Enkripsi end-to-end via Cloudflare network",
              "Cocok untuk router modern (RB5009, CCR2004, dll)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* SSTP */}
        <div className="card-glass rounded-2xl border border-amber-400/20 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-foreground">SSTP VPN</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
                RouterOS 6
              </span>
            </div>
          </div>
          <ul className="space-y-2">
            {[
              "Tidak memerlukan Docker atau container support",
              "SSTP client built-in di RouterOS 6.x",
              "Kompatibel dengan perangkat lama (RB750, RB951, dll)",
              "VPN terenkripsi langsung ke server kami",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Setup Guide ── */}
      <div className="card-glass rounded-2xl border border-border p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-headline font-bold text-foreground text-lg">Cara Setup Tunnel</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
          <GuideStep
            step={1}
            title="Tambah router terlebih dahulu"
            description="Pergi ke menu Routers → klik 'Provision Node'. Gunakan IP LAN router (192.168.88.1) sebagai host untuk sementara."
          />
          <GuideStep
            step={2}
            title="Kembali ke halaman Tunnel"
            description="Setelah router ditambahkan, buka halaman ini. Router akan muncul di daftar di bawah."
          />
          <GuideStep
            step={3}
            title="Klik 'Aktifkan' pada router"
            description="Pilih metode tunnel (Cloudflare atau SSTP) dan masukkan IP LAN router, lalu klik Aktifkan Tunnel."
          />
          <GuideStep
            step={4}
            title="Jalankan perintah di RouterOS"
            description="Salin perintah yang tampil dan jalankan di RouterOS Terminal. Tunnel akan otomatis terhubung dalam beberapa detik."
          />
        </div>

        <div className="mt-6 p-4 bg-primary/5 border border-primary/15 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Fitur Tunnel adalah add-on berbayar</span> yang terpisah dari paket standar.
            Hubungi admin untuk mengaktifkan fitur ini pada akun Anda.
          </p>
        </div>
      </div>

      {/* ── Router List ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Network className="h-4 w-4 text-muted-foreground/70" />
          <h3 className="font-headline font-bold text-foreground">Router Anda</h3>
          <span className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest">
            {routers.length} router
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground/50">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data router...</span>
          </div>
        ) : routers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 card-glass rounded-2xl border border-border">
            <Router className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">Belum ada router.</p>
            <p className="text-xs text-muted-foreground/40">
              Tambahkan router di menu <span className="font-semibold">Routers</span> terlebih dahulu.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {routers.map((router) => (
              <RouterTunnelRow key={router.id} router={router} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
