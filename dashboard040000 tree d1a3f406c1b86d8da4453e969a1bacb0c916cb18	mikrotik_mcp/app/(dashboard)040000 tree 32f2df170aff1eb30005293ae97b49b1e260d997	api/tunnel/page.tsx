"use client"

import { useState } from "react"
import {
  Cable,
  Router,
  AlertCircle,
  Loader2,
  Network,
  Copy,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTunnels } from "@/hooks/use-tunnels"
import { useRouters } from "@/hooks/use-routers"
import { TunnelStatusBadge } from "@/components/tunnel-status-badge"
import { TunnelManageDialog } from "@/components/tunnel-manage-dialog"
import { TunnelActivateDialog } from "@/components/tunnel-activate-dialog"
import type { TunnelStatus, TunnelMethod } from "@/lib/types/index"

// ── Method badge config ───────────────────────────────────────────────────────

const METHOD_BADGE: Record<
  TunnelMethod,
  { label: string; bg: string; text: string }
> = {
  CLOUDFLARE: {
    label: "CLOUDFLARE",
    bg: "bg-primary/10",
    text: "text-primary",
  },
  SSTP: {
    label: "SSTP",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
  },
  OVPN: {
    label: "OVPN",
    bg: "bg-orange-400/10",
    text: "text-orange-400",
  },
  WIREGUARD: {
    label: "WIREGUARD",
    bg: "bg-emerald-400/10",
    text: "text-emerald-400",
  },
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
    vpnAssignedIp?: string | null
    winboxPort?: number | null
    tunnelHostname?: string | null
  } | null
}

function WinboxCopyButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      toast.success("Alamat Winbox disalin")
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title={`Salin alamat Winbox: ${address}`}
      className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 border border-emerald-400/30 px-2.5 py-1 rounded-lg hover:bg-emerald-400/10 transition-all shrink-0"
    >
      {copied ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <ExternalLink className="h-3 w-3" />
      )}
      Winbox
    </button>
  )
}

function RouterTunnelRow({ router }: { router: RouterWithTunnel }) {
  const [activating, setActivating] = useState(false)
  const hasTunnel = router.connectionMethod === "TUNNEL"

  const tunnel = router.tunnel
  const isVpnMethod = tunnel?.method === "OVPN" || tunnel?.method === "WIREGUARD"

  // Build the VPS winbox address from tunnelHostname + winboxPort
  // tunnelHostname is the VPS hostname stored in the tunnel record
  const winboxAddress =
    isVpnMethod && tunnel?.winboxPort
      ? tunnel.tunnelHostname
        ? `${tunnel.tunnelHostname}:${tunnel.winboxPort}`
        : `:${tunnel.winboxPort}`
      : null

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

        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          {hasTunnel && tunnel ? (
            <>
              {/* Method badge */}
              {(() => {
                const badge = METHOD_BADGE[tunnel.method]
                return (
                  <span
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      badge.bg,
                      badge.text
                    )}
                  >
                    {badge.label}
                  </span>
                )
              })()}

              {/* VPN IP for OVPN/WG */}
              {isVpnMethod && tunnel.vpnAssignedIp && (
                <span className="text-[10px] font-mono-tech text-muted-foreground/70 hidden sm:inline">
                  {tunnel.vpnAssignedIp}
                </span>
              )}

              {/* Winbox port badge for OVPN/WG */}
              {isVpnMethod && tunnel.winboxPort && (
                <span className="text-[10px] font-mono-tech text-muted-foreground/60 hidden md:inline">
                  :{tunnel.winboxPort}
                </span>
              )}

              {/* Buka Winbox button for OVPN/WG tunnels with a winboxPort */}
              {winboxAddress && <WinboxCopyButton address={winboxAddress} />}

              <TunnelStatusBadge
                status={tunnel.status}
                method={tunnel.method}
                showMethod
              />
              <TunnelManageDialog
                routerId={router.id}
                routerName={router.name}
                tunnelMethod={tunnel.method}
                tunnelStatus={tunnel.status}
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
                Setup
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

  const routers: RouterWithTunnel[] = (routersQuery.data ?? []).map((r) => {
    const tunnel = tunnelsQuery.data?.find((t) => t.routerId === r.id)
    return {
      id: r.id,
      name: r.name,
      label: r.label,
      connectionMethod: (r as { connectionMethod?: string }).connectionMethod,
      tunnel: tunnel
        ? {
            status: tunnel.status as TunnelStatus,
            method: tunnel.method as TunnelMethod,
            vpnAssignedIp: tunnel.vpnAssignedIp,
            winboxPort: tunnel.winboxPort,
            tunnelHostname: tunnel.tunnelHostname,
          }
        : null,
    }
  })

  const tunnelCount = routers.filter((r) => r.connectionMethod === "TUNNEL").length
  const connectedCount = routers.filter((r) => r.tunnel?.status === "CONNECTED").length

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">
            Tunnel
          </h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Cable className="h-[18px] w-[18px] text-primary shrink-0" />
            Koneksi aman untuk router di balik NAT — tanpa IP publik.
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-headline font-bold text-foreground">{tunnelCount}</p>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">Tunnel</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-right">
            <p className="text-2xl font-headline font-bold text-tertiary">{connectedCount}</p>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">Terhubung</p>
          </div>
        </div>
      </div>

      {/* ── Tier notice ── */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl">
        <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Tunnel tersedia di semua plan.</span>{" "}
          Plan <span className="font-semibold text-foreground">Free</span> hanya bisa mengaktifkan port API (8728).
          Port Winbox, SSH, dan WebFig tersedia di plan{" "}
          <span className="font-semibold text-primary">Pro</span> dan{" "}
          <span className="font-semibold text-tertiary">Premium</span>.
        </p>
      </div>

      {/* ── Method legend ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mr-1">Metode:</span>
        {(Object.entries(METHOD_BADGE) as [TunnelMethod, typeof METHOD_BADGE[TunnelMethod]][]).map(([key, cfg]) => (
          <span
            key={key}
            className={cn(
              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
              cfg.bg,
              cfg.text
            )}
          >
            {cfg.label}
          </span>
        ))}
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
