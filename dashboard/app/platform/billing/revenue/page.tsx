"use client"

import { useEffect, useState } from "react"
import { TrendingUp, Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

interface RevenueData {
  totalRevenue: number
  totalInvoices: number
  paidCount: number
  pendingCount: number
  overdueCount: number
  byMonth: { month: string; amount: number }[]
  planBreakdown: { plan: string; count: number }[]
}

function fmtRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-zinc-500/20 text-zinc-400",
  PRO: "bg-[#4cd7f6]/20 text-[#4cd7f6]",
  PREMIUM: "bg-amber-500/20 text-amber-400",
}

export default function RevenueReportsPage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/platform/revenue")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  const maxMonth = data ? Math.max(...data.byMonth.map(m => m.amount), 1) : 1

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
          <TrendingUp className="h-7 w-7 text-[#4cd7f6]" /> Revenue Reports
        </h2>
        <p className="text-muted-foreground">Paid invoices summary — revenue from all tenants</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground py-12 text-center">Loading…</div>
      ) : !data ? (
        <div className="text-muted-foreground py-12 text-center">Failed to load</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: TrendingUp, label: "Total Revenue", value: fmtRp(data.totalRevenue), color: "text-[#4ae176]" },
              { icon: Receipt, label: "Total Invoices", value: data.totalInvoices.toLocaleString(), color: "text-[#4cd7f6]" },
              { icon: CheckCircle2, label: "Paid", value: data.paidCount.toLocaleString(), color: "text-[#4ae176]" },
              { icon: AlertTriangle, label: "Overdue", value: data.overdueCount.toLocaleString(), color: "text-red-400" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="card-glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs text-[#869397]">{label}</span>
                </div>
                <p className={`text-2xl font-headline font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Monthly chart */}
            <div className="md:col-span-2 card-glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-5">Monthly Revenue (IDR)</h3>
              {data.byMonth.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No paid invoices yet</div>
              ) : (
                <div className="space-y-3">
                  {data.byMonth.slice(-12).map(({ month, amount }) => (
                    <div key={month} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[#869397] w-16 shrink-0">{month}</span>
                      <div className="flex-1 h-5 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#4ae176]/70 transition-all"
                          style={{ width: `${Math.round((amount / maxMonth) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-foreground w-28 text-right shrink-0">{fmtRp(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Plan breakdown */}
            <div className="card-glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-5">Plan Breakdown</h3>
              {data.planBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No subscriptions</div>
              ) : (
                <div className="space-y-3">
                  {data.planBreakdown.map(({ plan, count }) => (
                    <div key={plan} className="flex items-center justify-between">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan] ?? "bg-zinc-500/15 text-zinc-400"}`}>
                        {plan}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{count} tenant{count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 text-xs text-[#869397]">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{data.pendingCount} pending invoice{data.pendingCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
