"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Shield,
  Heart,
  AlertTriangle,
  Cpu,
  HardDrive,
  Thermometer,
  Clock,
  Users,
  Terminal,
  RefreshCw,
} from "lucide-react"

interface RouterHealth {
  id: string
  name: string
  status: "online" | "offline"
  cpuLoad?: number
  memoryPercent?: number
  uptime?: string
  activeClients?: number
  version?: string
}

export function NetworkContextPanel() {
  const [router, setRouter] = useState<RouterHealth | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/routers/health")
      if (res.ok) {
        const data: RouterHealth[] = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setRouter(data[0])
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const cpuLoad = router?.cpuLoad ?? 0
  const memoryPercent = router?.memoryPercent ?? 0
  const isOnline = router?.status === "online"

  return (
    <aside className="card-glass hidden w-80 flex-col border-l border-border lg:flex">
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-6">
          {/* Header */}
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70 font-label">
            Network Context
          </h3>

          {/* Active Router Card */}
          <div className="card-glass rounded-xl p-4 border border-primary/20">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Primary Router</span>
              <Badge
                variant="outline"
                className={
                  isOnline
                    ? "border-transparent bg-emerald-500/10 text-[10px] font-bold uppercase text-emerald-500"
                    : "border-transparent bg-red-500/10 text-[10px] font-bold uppercase text-red-400"
                }
              >
                {loading ? "..." : isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
            <div className="mb-1 text-sm font-bold text-foreground">
              {router?.name || "No router connected"}
            </div>
            {router?.version && (
              <div className="font-mono text-[11px] text-cyan-500">
                RouterOS {router.version}
              </div>
            )}

            {/* CPU / Memory Bars */}
            {isOnline && (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>CPU Usage</span>
                    <span>{cpuLoad}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${cpuLoad}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>RAM Usage</span>
                    <span>{memoryPercent}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${memoryPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Health Check */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground/70">
              <Heart className="h-3.5 w-3.5" />
              Health Check
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">Uptime</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {router?.uptime || "--"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">Active Clients</span>
                <span className="font-mono text-xs text-primary">
                  {router?.activeClients ?? "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground/70">
              <Terminal className="h-3.5 w-3.5" />
              Quick Actions
            </h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 rounded-lg border-border bg-muted/40 text-xs text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                onClick={fetchHealth}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Status
              </Button>
            </div>
          </div>

          {/* Active Alerts */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground/70">
              <AlertTriangle className="h-3.5 w-3.5" />
              Active Alerts
            </h4>
            <div className="space-y-3">
              {!isOnline && !loading ? (
                <div className="rounded-r-lg border-l-2 border-amber-500 bg-amber-500/5 p-3">
                  <div className="mb-1 text-[11px] font-bold text-amber-500">
                    Router Unreachable
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Cannot connect to primary router. Check network connectivity.
                  </div>
                </div>
              ) : (
                <div className="rounded-r-lg border-l-2 border-cyan-500 bg-cyan-500/5 p-3">
                  <div className="mb-1 text-[11px] font-bold text-cyan-500">
                    System Normal
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    All systems operating within normal parameters.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
