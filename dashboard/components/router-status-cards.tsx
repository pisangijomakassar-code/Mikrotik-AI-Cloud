"use client"

import { Router, Cpu, HardDrive, Users, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouters } from "@/hooks/use-routers"
import { cn } from "@/lib/utils"

function ProgressBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct < 60 ? "bg-emerald-500" : pct < 85 ? "bg-amber-500" : "bg-red-500"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        status === "online" && "bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.4)]",
        status === "offline" && "bg-[#ffb4ab]",
        status === "warning" && "bg-amber-400"
      )}
    />
  )
}

export function RouterStatusCards() {
  const { data: routers, isLoading } = useRouters()

  return (
    <Card className="border-0 bg-[#171f33] rounded-lg" style={{ boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Router className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Router Health</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[380px] pr-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg bg-[#131b2e] p-4 space-y-3"
                >
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-1.5 w-full rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : !routers?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No routers configured
            </p>
          ) : (
            <div className="space-y-3">
              {routers.map((router) => {
                const health = router.health
                const status: string = health?.status || "offline"
                return (
                  <div
                    key={router.id}
                    className="rounded-lg bg-[#131b2e] p-4 transition-colors border-0"
                    style={{ boxShadow: '0 0 16px rgba(76,215,246,0.04)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusDot status={status} />
                        <span className="text-sm font-medium text-foreground">
                          {router.name}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          status === "online" && "border-emerald-500/30 text-emerald-400",
                          status === "offline" && "border-red-500/30 text-red-400",
                          status === "warning" && "border-amber-500/30 text-amber-400"
                        )}
                      >
                        {status}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {router.host}:{router.port}
                    </p>
                    {health && status !== "offline" && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Cpu className="h-3 w-3" />
                            <span>CPU</span>
                          </div>
                          <span className="text-foreground">{health.cpuLoad}%</span>
                        </div>
                        <ProgressBar value={health.cpuLoad} max={100} />

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <HardDrive className="h-3 w-3" />
                            <span>Memory</span>
                          </div>
                          <span className="text-foreground">
                            {Math.round(health.memoryUsed / 1024 / 1024)}MB / {Math.round(health.memoryTotal / 1024 / 1024)}MB
                          </span>
                        </div>
                        <ProgressBar value={health.memoryUsed} max={health.memoryTotal} />

                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{health.activeClients} clients</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{health.uptime}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
