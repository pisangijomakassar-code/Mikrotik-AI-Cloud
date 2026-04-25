"use client"

import { cn } from "@/lib/utils"
import type { TunnelMethod, TunnelStatus } from "@/lib/types"

interface TunnelStatusBadgeProps {
  status: TunnelStatus | null | undefined
  method?: TunnelMethod
  showMethod?: boolean
  className?: string
}

const STATUS_CONFIG: Record<
  TunnelStatus | "NONE",
  { dot: string; label: string; bg: string; text: string }
> = {
  PENDING: {
    dot: "bg-amber-400 animate-pulse",
    label: "Menunggu koneksi",
    bg: "bg-amber-400/10",
    text: "text-amber-400",
  },
  CONNECTED: {
    dot: "bg-[#4ae176]",
    label: "Terhubung",
    bg: "bg-[#4ae176]/10",
    text: "text-tertiary",
  },
  DISCONNECTED: {
    dot: "bg-[#ffb4ab]",
    label: "Terputus",
    bg: "bg-[#ffb4ab]/10",
    text: "text-destructive",
  },
  ERROR: {
    dot: "bg-[#ffb4ab]",
    label: "Error",
    bg: "bg-[#ffb4ab]/10",
    text: "text-destructive",
  },
  NONE: {
    dot: "bg-slate-500",
    label: "Tidak ada tunnel",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
  },
}

const METHOD_LABEL: Record<TunnelMethod, string> = {
  CLOUDFLARE: "Cloudflare",
  SSTP: "SSTP",
  OVPN: "OpenVPN",
  WIREGUARD: "WireGuard",
}

export function TunnelStatusBadge({
  status,
  method,
  showMethod = false,
  className,
}: TunnelStatusBadgeProps) {
  const key = status ?? "NONE"
  const config = STATUS_CONFIG[key]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
      {showMethod && method && (
        <span className="opacity-70">({METHOD_LABEL[method]})</span>
      )}
    </span>
  )
}
