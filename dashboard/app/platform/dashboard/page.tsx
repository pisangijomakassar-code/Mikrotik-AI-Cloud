"use client"

import { useEffect, useState } from "react"
import { Building2, Router, Users, Clock, TrendingUp, AlertTriangle } from "lucide-react"
import { TenantTable, type TenantRow } from "@/components/platform/tenant-table"

interface Stats {
  tenants: { total: number; active: number; trial: number; suspended: number; expired: number; churned: number }
  totalRouters: number
  totalUsers: number
  expiringSoonCount: number
  recentTenants: TenantRow[]
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="card-glass rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ?? "bg-primary/10"}`}>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-headline font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-[#869397] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function PlatformDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/stats")
      if (res.ok) setStats(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const t = stats?.tenants

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">
          Platform Dashboard
        </h2>
        <p className="text-muted-foreground">MRR, active tenants, system health overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Building2}
          label="Total Tenants"
          value={loading ? "—" : (t?.total ?? 0)}
          sub={loading ? undefined : `${t?.active ?? 0} active · ${t?.trial ?? 0} trial`}
          accent="bg-[#4cd7f6]/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Active Tenants"
          value={loading ? "—" : (t?.active ?? 0)}
          sub={loading ? undefined : `${t?.suspended ?? 0} suspended · ${t?.expired ?? 0} expired`}
          accent="bg-[#4ae176]/10"
        />
        <StatCard
          icon={Router}
          label="Total Routers"
          value={loading ? "—" : (stats?.totalRouters ?? 0)}
          sub="Across all tenants"
          accent="bg-violet-500/10"
        />
        <StatCard
          icon={Clock}
          label="Expiring Soon"
          value={loading ? "—" : (stats?.expiringSoonCount ?? 0)}
          sub="Within 30 days"
          accent={stats?.expiringSoonCount ? "bg-amber-500/10" : "bg-zinc-500/10"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card-glass rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium mb-3 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> Tenant Breakdown
          </p>
          <div className="space-y-2">
            {[
              { label: "Active",    value: t?.active ?? 0,    color: "bg-[#4ae176]" },
              { label: "Trial",     value: t?.trial ?? 0,     color: "bg-[#4cd7f6]" },
              { label: "Suspended", value: t?.suspended ?? 0, color: "bg-amber-400" },
              { label: "Expired",   value: t?.expired ?? 0,   color: "bg-red-400" },
              { label: "Churned",   value: t?.churned ?? 0,   color: "bg-zinc-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  {label}
                </span>
                <span className="font-mono font-semibold text-foreground">{loading ? "—" : value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-glass rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium mb-3 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> Platform Users
          </p>
          <p className="text-3xl font-headline font-bold">{loading ? "—" : (stats?.totalUsers ?? 0)}</p>
          <p className="text-xs text-[#869397] mt-1">Admin + User accounts (all tenants)</p>
        </div>

        <div className="card-glass rounded-xl p-5 flex flex-col justify-between">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Attention
          </p>
          <div className="space-y-2 mt-3">
            {stats?.expiringSoonCount ? (
              <a
                href="/platform/tenants/expiring"
                className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Clock className="h-3.5 w-3.5" />
                {stats.expiringSoonCount} tenant{stats.expiringSoonCount !== 1 ? "s" : ""} expiring soon
              </a>
            ) : null}
            {t?.suspended ? (
              <a
                href="/platform/tenants/suspended"
                className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {t.suspended} suspended tenant{t.suspended !== 1 ? "s" : ""}
              </a>
            ) : null}
            {!stats?.expiringSoonCount && !t?.suspended && (
              <p className="text-sm text-[#869397]">All clear</p>
            )}
          </div>
        </div>
      </div>

      <div className="card-glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-semibold text-foreground">Recent Tenants</h3>
          <a href="/platform/tenants" className="text-xs text-[#4cd7f6] hover:underline">View all →</a>
        </div>
        <TenantTable
          tenants={stats?.recentTenants ?? []}
          loading={loading}
          onRefresh={load}
          showSearch={false}
        />
      </div>
    </div>
  )
}
