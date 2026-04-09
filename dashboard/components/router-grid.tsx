"use client"

import { useState } from "react"
import { Search, Cpu, HardDrive, Users, Router } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouters } from "@/hooks/use-routers"
import { AddRouterDialog } from "@/components/add-router-dialog"
import { cn } from "@/lib/utils"

function ProgressBar({
  value,
  max,
  label,
  icon: Icon,
}: {
  value: number
  max: number
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </div>
        <span className="text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct < 60 ? "bg-emerald-500" : pct < 85 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function RouterGrid() {
  const [search, setSearch] = useState("")
  const { data: routers, isLoading } = useRouters(search || undefined)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search routers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <AddRouterDialog />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="pt-0 space-y-3 animate-pulse">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-1.5 w-full rounded bg-muted" />
                <div className="h-1.5 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !routers?.length ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Router className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No routers found
            </p>
            <p className="text-xs text-muted-foreground/70">
              Add a router to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routers.map((router) => {
            const health = router.health
            const status: string = health?.status || "offline"
            return (
              <Card
                key={router.id}
                className="border-border bg-card transition-colors hover:border-primary/30"
              >
                <CardContent className="pt-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          status === "online" &&
                            "bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.4)]",
                          status === "offline" && "bg-red-400",
                          status === "warning" && "bg-amber-400"
                        )}
                      />
                      <h3 className="font-semibold text-foreground">
                        {router.name}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        status === "online" &&
                          "border-emerald-500/30 text-emerald-400",
                        status === "offline" &&
                          "border-red-500/30 text-red-400",
                        status === "warning" &&
                          "border-amber-500/30 text-amber-400"
                      )}
                    >
                      {status}
                    </Badge>
                  </div>

                  <div className="mt-2 space-y-1">
                    {router.user?.name && (
                      <p className="text-xs text-muted-foreground">
                        Owner: {router.user.name}
                      </p>
                    )}
                    <p className="font-mono text-xs text-muted-foreground">
                      {router.host}:{router.port}
                    </p>
                  </div>

                  {health && status !== "offline" && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {health.board && <span>{health.board}</span>}
                        {health.version && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            v{health.version}
                          </Badge>
                        )}
                      </div>

                      <ProgressBar
                        value={health.cpuLoad}
                        max={100}
                        label="CPU"
                        icon={Cpu}
                      />
                      <ProgressBar
                        value={health.memoryUsed}
                        max={health.memoryTotal}
                        label="Memory"
                        icon={HardDrive}
                      />

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>
                          {health.activeClients} active client
                          {health.activeClients !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
