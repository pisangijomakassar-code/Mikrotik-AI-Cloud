"use client"

import { useEffect, useState, useCallback } from "react"
import { Database, Bot, RefreshCw, CheckCircle2, XCircle, Building2, Router, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

interface Health {
  timestamp: string
  db: { ok: boolean; latencyMs: number }
  agent: { ok: boolean; latencyMs: number | null }
  platform: { tenantCount: number; routerCount: number; userCount: number; activeTenantsCount: number }
}

function StatusRow({ ok, label, latency }: { ok: boolean; label: string; latency?: number | null }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center gap-3">
        {ok
          ? <CheckCircle2 className="h-4 w-4 text-[#4ae176]" />
          : <XCircle className="h-4 w-4 text-red-400" />}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {latency != null && (
          <span className="text-xs font-mono text-[#869397]">{latency}ms</span>
        )}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ok ? "bg-[#4ae176]/15 text-[#4ae176]" : "bg-red-500/15 text-red-400"}`}>
          {ok ? "OK" : "DOWN"}
        </span>
      </div>
    </div>
  )
}

export default function HealthCheckPage() {
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/health")
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const allOk = data ? data.db.ok : null

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Health Check</h2>
          <p className="text-muted-foreground">
            {data ? `Last checked: ${format(new Date(data.timestamp), "HH:mm:ss, dd MMM yyyy")}` : "Checking…"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall status banner */}
      {data && (
        <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${allOk ? "bg-[#4ae176]/10 border border-[#4ae176]/20" : "bg-red-500/10 border border-red-500/20"}`}>
          {allOk
            ? <CheckCircle2 className="h-5 w-5 text-[#4ae176]" />
            : <XCircle className="h-5 w-5 text-red-400" />}
          <span className={`font-headline font-semibold ${allOk ? "text-[#4ae176]" : "text-red-400"}`}>
            {allOk ? "All systems operational" : "One or more systems are down"}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services */}
        <div className="card-glass rounded-2xl p-6">
          <h3 className="font-headline font-semibold text-foreground mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-[#4cd7f6]" /> Services
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : data ? (
            <div>
              <StatusRow ok={data.db.ok} label="PostgreSQL Database" latency={data.db.latencyMs} />
              <StatusRow ok={data.agent.ok} label="Python AI Agent" latency={data.agent.latencyMs} />
            </div>
          ) : (
            <p className="text-sm text-red-400">Failed to load health data</p>
          )}
        </div>

        {/* Platform stats */}
        <div className="card-glass rounded-2xl p-6">
          <h3 className="font-headline font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#4cd7f6]" /> Platform Counts
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : data ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Building2, label: "Total Tenants", value: data.platform.tenantCount },
                { icon: Building2, label: "Active Tenants", value: data.platform.activeTenantsCount },
                { icon: Router, label: "Total Routers", value: data.platform.routerCount },
                { icon: Users, label: "Total Users", value: data.platform.userCount },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-white/[0.03] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3.5 w-3.5 text-[#869397]" />
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                  </div>
                  <span className="text-xl font-headline font-bold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
