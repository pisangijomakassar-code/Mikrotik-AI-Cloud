"use client"

import { useQuery } from "@tanstack/react-query"
import { Cpu, MemoryStick, HardDrive, Wifi, Users, Sparkles, RefreshCw, Pause } from "lucide-react"
import { useActiveRouter } from "@/components/active-router-context"
import { useIdleAware } from "@/hooks/use-idle-aware"
import { cn } from "@/lib/utils"

interface QuickStats {
  router: string
  cpu: number
  memory: { free: number; total: number; percent: number }
  hdd: { free: number; total: number; percent: number }
  uptime: string
  board: string
  version: string
  hotspot: {
    totalUsers: number
    activeSessions: number
    enabledUsers: number
    disabledUsers: number
  }
}

const IDLE_MS = 30 * 60 * 1000  // 30 menit
const POLL_MS = 30 * 1000       // 30 detik aktif

function pillColor(percent: number): string {
  if (percent >= 85) return "text-destructive"
  if (percent >= 70) return "text-amber-400"
  return "text-tertiary"
}

export function RouterQuickStatsPills() {
  const { activeRouter } = useActiveRouter()
  const isIdle = useIdleAware(IDLE_MS)

  const { data, isLoading, isFetching, refetch, error } = useQuery<QuickStats>({
    queryKey: ["quickstats", activeRouter],
    queryFn: async () => {
      const qs = activeRouter ? `?router=${encodeURIComponent(activeRouter)}` : ""
      const res = await fetch(`/api/routers/quickstats${qs}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: !!activeRouter,
    refetchInterval: isIdle ? false : POLL_MS,
    refetchIntervalInBackground: false,  // pause saat tab di background
    refetchOnWindowFocus: true,           // refresh saat tab kembali aktif
    staleTime: 25_000,                    // jangan double-fetch dalam window cache server
    retry: 0,                             // jangan retry — router down = langsung fallback ke "LLM down"
  })

  if (!activeRouter) return null

  const llmReady = !error && !isLoading && data
  const memPct = data?.memory.percent ?? 0
  const hddPct = data?.hdd.percent ?? 0
  const cpu = data?.cpu ?? 0

  return (
    <div className="hidden md:flex items-center gap-1.5 text-xs font-mono-tech">
      {/* LLM/Agent status */}
      <Pill
        icon={<Sparkles className={cn("h-3.5 w-3.5", llmReady ? "text-tertiary" : "text-destructive")} />}
        label={llmReady ? "LLM ready" : "LLM down"}
        labelClass={llmReady ? "text-tertiary" : "text-destructive"}
      />

      {/* CPU */}
      <Pill
        icon={<Cpu className={cn("h-3.5 w-3.5", pillColor(cpu))} />}
        label={`CPU ${cpu}%`}
        labelClass={pillColor(cpu)}
      />

      {/* Memory */}
      <Pill
        icon={<MemoryStick className={cn("h-3.5 w-3.5", pillColor(memPct))} />}
        label={`RAM ${memPct}%`}
        labelClass={pillColor(memPct)}
      />

      {/* HDD */}
      <Pill
        icon={<HardDrive className={cn("h-3.5 w-3.5", pillColor(hddPct))} />}
        label={`HDD ${hddPct}%`}
        labelClass={pillColor(hddPct)}
      />

      {/* Hotspot client (active session) */}
      <Pill
        icon={<Wifi className="h-3.5 w-3.5 text-primary" />}
        label={`${data?.hotspot.activeSessions ?? 0}`}
        title="Active session"
      />

      {/* Total users */}
      <Pill
        icon={<Users className="h-3.5 w-3.5 text-primary" />}
        label={`${data?.hotspot.totalUsers ?? 0}`}
        title="Total user voucher"
      />

      {/* Idle indicator + manual refresh */}
      {isIdle ? (
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
          title="Polling pause (idle 30 menit) — klik untuk refresh"
        >
          <Pause className="h-3.5 w-3.5" />
          paused
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      ) : isFetching ? (
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40 animate-spin ml-1" />
      ) : null}
    </div>
  )
}

function Pill({
  icon, label, title, labelClass,
}: {
  icon: React.ReactNode
  label: string
  title?: string
  labelClass?: string
}) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded bg-muted/40 border border-white/5"
      title={title}
    >
      {icon}
      <span className={cn("text-xs", labelClass ?? "text-foreground")}>{label}</span>
    </div>
  )
}
