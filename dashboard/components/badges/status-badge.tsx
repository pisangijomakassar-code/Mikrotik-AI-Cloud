import { cn } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-[#4ae176]/15 text-[#4ae176]",
  INACTIVE: "bg-slate-700/50 text-slate-400",
  ONLINE: "bg-[#4ae176]/15 text-[#4ae176]",
  OFFLINE: "bg-slate-700/50 text-slate-400",
  ENABLED: "bg-[#4ae176]/10 text-[#4ae176]",
  DISABLED: "bg-[#93000a]/20 text-[#ffb4ab]",
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const style = statusStyles[status.toUpperCase()] ?? "bg-slate-700/50 text-slate-400"
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
        style,
        className
      )}
    >
      {status}
    </span>
  )
}
