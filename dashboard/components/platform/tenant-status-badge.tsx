"use client"

import { Badge } from "@/components/ui/badge"

const config: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: "Active",    className: "bg-[#4ae176]/15 text-[#4ae176] border-[#4ae176]/20" },
  TRIAL:     { label: "Trial",     className: "bg-[#4cd7f6]/15 text-[#4cd7f6] border-[#4cd7f6]/20" },
  SUSPENDED: { label: "Suspended", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  EXPIRED:   { label: "Expired",   className: "bg-red-500/15 text-red-400 border-red-500/20" },
  CHURNED:   { label: "Churned",   className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" },
}

export function TenantStatusBadge({ status }: { status: string }) {
  const c = config[status] ?? { label: status, className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20" }
  return (
    <Badge variant="outline" className={`text-[10px] font-mono font-semibold px-2 py-0.5 ${c.className}`}>
      {c.label}
    </Badge>
  )
}
