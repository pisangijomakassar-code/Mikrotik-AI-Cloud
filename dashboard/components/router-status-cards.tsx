"use client"

import { Cpu, HardDrive, Wifi, Router } from "lucide-react"
import { useRouters } from "@/hooks/use-routers"
import { cn } from "@/lib/utils"

export function RouterStatusCards() {
  const { data: routers, isLoading } = useRouters()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-xl animate-pulse card-glass"
          >
            <div className="h-4 w-20 rounded bg-muted mb-3" />
            <div className="h-6 w-12 rounded bg-muted mb-2" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  if (!routers?.length) {
    return (
      <div
        className="rounded-xl p-8 flex flex-col items-center justify-center gap-3 card-glass"
      >
        <Router className="h-8 w-8 text-muted-foreground/70" />
        <p className="text-sm text-muted-foreground">No routers configured</p>
        <p className="text-[10px] text-muted-foreground/70">
          Add a router to see live status here
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {routers.map((router) => {
        const isOnline = router.health?.status === "online"
        const cpuLoad = router.health?.cpuLoad ?? 0
        const memPercent = router.health?.memoryPercent ?? 0
        const clients = router.health?.activeClients ?? 0

        return (
          <div
            key={router.id}
            className="p-5 rounded-xl card-glass"
          >
            {/* Router name + status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Router className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground truncate max-w-[140px]">
                  {router.name}
                </span>
              </div>
              <span
                className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-lg border",
                  isOnline
                    ? "bg-[#4ae176]/10 text-[#4ae176] border-[#4ae176]/20"
                    : "bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/20"
                )}
              >
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            {/* Metrics */}
            <div className="space-y-3">
              {/* CPU */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-[10px] text-muted-foreground/70 uppercase font-bold">
                    CPU
                  </span>
                </div>
                <span className="text-xs font-mono-tech text-foreground">
                  {cpuLoad}%
                </span>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    cpuLoad > 80
                      ? "bg-[#ffb4ab]"
                      : cpuLoad > 50
                        ? "bg-amber-400"
                        : "bg-primary"
                  )}
                  style={{ width: `${Math.min(cpuLoad, 100)}%` }}
                />
              </div>

              {/* Memory */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-[10px] text-muted-foreground/70 uppercase font-bold">
                    Memory
                  </span>
                </div>
                <span className="text-xs font-mono-tech text-foreground">
                  {memPercent}%
                </span>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    memPercent > 80
                      ? "bg-[#ffb4ab]"
                      : memPercent > 50
                        ? "bg-amber-400"
                        : "bg-[#4ae176]"
                  )}
                  style={{ width: `${Math.min(memPercent, 100)}%` }}
                />
              </div>

              {/* Active Clients */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="text-[10px] text-muted-foreground/70 uppercase font-bold">
                    Clients
                  </span>
                </div>
                <span className="text-xs font-mono-tech text-primary font-bold">
                  {clients}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
