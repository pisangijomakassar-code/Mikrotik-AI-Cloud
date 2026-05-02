"use client"

import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TenantStatusBadge } from "@/components/platform/tenant-status-badge"
import { Zap, Router, Users } from "lucide-react"

interface TenantUsage {
  id: string
  name: string
  slug: string
  status: string
  userCount: number
  routerCount: number
  subscription: { plan: string; tokenLimit: number; tokensUsed: number } | null
  monthlyTokens: { tokensIn: number; tokensOut: number }
}

export default function UsagePage() {
  const [data, setData] = useState<TenantUsage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/usage")
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalTokensThisMonth = data.reduce(
    (s, t) => s + t.monthlyTokens.tokensIn + t.monthlyTokens.tokensOut, 0
  )

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Per-Tenant Usage</h2>
        <p className="text-muted-foreground">
          {loading ? "Loading…" : `${data.length} tenants · ${totalTokensThisMonth.toLocaleString()} tokens this month`}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card-glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2"><Zap className="h-3.5 w-3.5" /> Total Tokens (this month)</p>
          <p className="text-2xl font-headline font-bold">{loading ? "—" : totalTokensThisMonth.toLocaleString()}</p>
        </div>
        <div className="card-glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2"><Router className="h-3.5 w-3.5" /> Total Routers</p>
          <p className="text-2xl font-headline font-bold">{loading ? "—" : data.reduce((s, t) => s + t.routerCount, 0)}</p>
        </div>
        <div className="card-glass rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2"><Users className="h-3.5 w-3.5" /> Total Users</p>
          <p className="text-2xl font-headline font-bold">{loading ? "—" : data.reduce((s, t) => s + t.userCount, 0)}</p>
        </div>
      </div>

      <div className="card-glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#869397] font-medium">Tenant</TableHead>
              <TableHead className="text-[#869397] font-medium">Status</TableHead>
              <TableHead className="text-[#869397] font-medium">Plan</TableHead>
              <TableHead className="text-[#869397] font-medium text-center">
                <span className="flex items-center gap-1 justify-center"><Router className="h-3 w-3" /> Routers</span>
              </TableHead>
              <TableHead className="text-[#869397] font-medium text-center">
                <span className="flex items-center gap-1 justify-center"><Users className="h-3 w-3" /> Users</span>
              </TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Tokens (month)</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Token Limit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No tenants found</TableCell></TableRow>
            ) : (
              data.map((t) => {
                const totalTokens = t.monthlyTokens.tokensIn + t.monthlyTokens.tokensOut
                const limit = t.subscription?.tokenLimit ?? 0
                const unlimited = limit < 0
                const pct = !unlimited && limit > 0 ? Math.min(100, Math.round((totalTokens / limit) * 100)) : null

                return (
                  <TableRow key={t.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{t.name}</div>
                      <div className="text-[11px] text-[#869397] font-mono">{t.slug}</div>
                    </TableCell>
                    <TableCell><TenantStatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-xs text-[#869397] font-mono">{t.subscription?.plan ?? "—"}</TableCell>
                    <TableCell className="text-center text-sm font-mono">{t.routerCount}</TableCell>
                    <TableCell className="text-center text-sm font-mono">{t.userCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-mono">{totalTokens.toLocaleString()}</div>
                      {pct != null && (
                        <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-[#4ae176]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-[#869397]">
                      {unlimited ? "∞" : limit ? limit.toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
