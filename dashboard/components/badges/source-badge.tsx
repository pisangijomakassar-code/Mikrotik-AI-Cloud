import { cn } from "@/lib/utils"

const sourceStyles: Record<string, string> = {
  dashboard: "bg-[#4cd7f6]/15 text-[#4cd7f6]",
  nanobot: "bg-[#4ae176]/15 text-[#4ae176]",
  reseller_bot: "bg-[#a78bfa]/15 text-[#a78bfa]",
}

const sourceLabels: Record<string, string> = {
  dashboard: "Dashboard",
  nanobot: "Nanobot",
  reseller_bot: "Reseller Bot",
}

export function SourceBadge({ source, className }: { source: string; className?: string }) {
  const style = sourceStyles[source] ?? "bg-slate-700/50 text-slate-400"
  const label = sourceLabels[source] ?? source
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", style, className)}>
      {label}
    </span>
  )
}

const txTypeStyles: Record<string, string> = {
  TOP_UP: "bg-[#4ae176]/15 text-[#4ae176]",
  TOP_DOWN: "bg-[#ffb4ab]/15 text-[#ffb4ab]",
  VOUCHER_PURCHASE: "bg-[#4cd7f6]/15 text-[#4cd7f6]",
}

const txTypeLabels: Record<string, string> = {
  TOP_UP: "Top Up",
  TOP_DOWN: "Top Down",
  VOUCHER_PURCHASE: "Voucher Purchase",
}

export function TransactionTypeBadge({ type, className }: { type: string; className?: string }) {
  const style = txTypeStyles[type] ?? "bg-slate-700/50 text-slate-400"
  const label = txTypeLabels[type] ?? type
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", style, className)}>
      {label}
    </span>
  )
}
