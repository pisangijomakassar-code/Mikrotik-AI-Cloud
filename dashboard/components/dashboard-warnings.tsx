"use client"

import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react"
import { useRouters } from "@/hooks/use-routers"

interface Warning {
  level: "warning" | "critical"
  message: string
}

export function DashboardWarnings() {
  const { data: routers, isLoading } = useRouters()

  if (isLoading) {
    return (
      <div
        className="rounded-2xl p-6 card-glass"
      >
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
      </div>
    )
  }

  const warnings: Warning[] = []

  if (routers) {
    for (const router of routers) {
      if (!router.health || router.health.status === "offline") {
        warnings.push({
          level: "critical",
          message: `Router ${router.name} is offline`,
        })
        continue
      }

      const cpu = router.health.cpuLoad ?? 0
      const mem = router.health.memoryPercent ?? 0

      if (cpu > 80) {
        warnings.push({
          level: "warning",
          message: `High CPU usage on ${router.name}: ${cpu}%`,
        })
      }

      if (mem > 90) {
        warnings.push({
          level: "critical",
          message: `Memory critically low on ${router.name}: ${mem}%`,
        })
      }
    }
  }

  return (
    <div
      className="rounded-2xl p-6 card-glass"
    >
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="h-5 w-5 text-amber-400" />
        <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">
          Network Alerts
        </h3>
      </div>

      {warnings.length === 0 ? (
        <div className="flex items-center gap-3 py-3">
          <div className="p-2 rounded-lg bg-[#4ae176]/10">
            <CheckCircle className="h-5 w-5 text-[#4ae176]" />
          </div>
          <span className="text-sm text-[#4ae176] font-medium">
            All systems normal
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {warnings.map((warning, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background:
                  warning.level === "critical"
                    ? "rgba(255, 180, 171, 0.06)"
                    : "rgba(251, 191, 36, 0.06)",
                border:
                  warning.level === "critical"
                    ? "1px solid rgba(255, 180, 171, 0.12)"
                    : "1px solid rgba(251, 191, 36, 0.12)",
              }}
            >
              <AlertTriangle
                className={`h-4 w-4 flex-shrink-0 ${
                  warning.level === "critical"
                    ? "text-[#ffb4ab]"
                    : "text-amber-400"
                }`}
              />
              <span className="text-sm text-foreground">{warning.message}</span>
              <span
                className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-lg border flex-shrink-0 ${
                  warning.level === "critical"
                    ? "bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/20"
                    : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                }`}
              >
                {warning.level === "critical" ? "CRITICAL" : "WARNING"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
