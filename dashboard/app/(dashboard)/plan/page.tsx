"use client"

import { useState, useEffect } from "react"
import { CreditCard, Zap, TrendingUp, FileText, Loader2, CheckCircle, Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlanData {
  subscription: {
    plan: string
    status: string
    tokenLimit: number
    tokensUsed: number
    billingCycleStart: string
    billingCycleEnd: string | null
  }
  usage: {
    totalIn: number
    totalOut: number
    totalRequests: number
  }
  dailyUsage: Array<{
    date: string
    totalIn: number
    totalOut: number
    count: number
  }>
  invoices: Array<{
    id: string
    number: string
    status: string
    amount: number
    currency: string
    periodStart: string
    periodEnd: string
    tokensUsed: number
    paidAt: string | null
    createdAt: string
  }>
}

const PLAN_DETAILS: Record<string, { label: string; color: string; features: string[] }> = {
  FREE: {
    label: "Free",
    color: "text-slate-400",
    features: ["20,000 tokens/month", "1 router", "Basic AI assistant", "Community support"],
  },
  PRO: {
    label: "Pro",
    color: "text-[#4cd7f6]",
    features: ["200,000 tokens/month", "10 routers", "Advanced AI assistant", "Priority support", "Custom alerts"],
  },
  ENTERPRISE: {
    label: "Enterprise",
    color: "text-[#4ae176]",
    features: ["Unlimited tokens", "Unlimited routers", "Full AI suite", "Dedicated support", "Custom integrations", "SLA guarantee"],
  },
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency }).format(amount / 100)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function statusIcon(status: string) {
  switch (status) {
    case "PAID": return <CheckCircle className="h-3.5 w-3.5 text-[#4ae176]" />
    case "PENDING": return <Clock className="h-3.5 w-3.5 text-amber-400" />
    case "OVERDUE": return <AlertTriangle className="h-3.5 w-3.5 text-[#ffb4ab]" />
    default: return <FileText className="h-3.5 w-3.5 text-slate-400" />
  }
}

function statusColor(status: string) {
  switch (status) {
    case "PAID": return "text-[#4ae176] bg-[#4ae176]/10"
    case "PENDING": return "text-amber-400 bg-amber-400/10"
    case "OVERDUE": return "text-[#ffb4ab] bg-[#ffb4ab]/10"
    default: return "text-slate-400 bg-slate-400/10"
  }
}

export default function PlanPage() {
  const [data, setData] = useState<PlanData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-[#4cd7f6] animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { subscription, usage, dailyUsage, invoices } = data
  const planInfo = PLAN_DETAILS[subscription.plan] ?? PLAN_DETAILS.FREE
  const usagePercent = subscription.tokenLimit > 0
    ? Math.min(Math.round(((usage.totalIn + usage.totalOut) / subscription.tokenLimit) * 100), 100)
    : 0
  const totalTokens = usage.totalIn + usage.totalOut

  // Find max daily usage for bar chart scaling
  const maxDaily = Math.max(...dailyUsage.map((d) => d.totalIn + d.totalOut), 1)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Plan & Billing</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <CreditCard className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Manage your subscription and monitor usage.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Plan */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current Plan</span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase border",
                subscription.status === "ACTIVE"
                  ? "bg-[#4ae176]/10 text-[#4ae176] border-[#4ae176]/20"
                  : "bg-amber-400/10 text-amber-400 border-amber-400/20"
              )}>
                {subscription.status}
              </span>
            </div>
            <h3 className={cn("text-3xl font-headline font-bold mb-1", planInfo.color)}>
              {planInfo.label}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              {subscription.billingCycleEnd
                ? `Renews ${formatDate(subscription.billingCycleEnd)}`
                : "No expiration"}
            </p>

            <div className="space-y-3">
              {planInfo.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle className="h-3.5 w-3.5 text-[#4ae176] shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            {subscription.plan !== "ENTERPRISE" && (
              <button className="w-full mt-6 py-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-[#4cd7f6] to-[#06b6d4] text-[#003640] hover:brightness-110 transition-all">
                Upgrade Plan
              </button>
            )}
          </div>

          {/* All Plans */}
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Available Plans</span>
            <div className="mt-4 space-y-3">
              {Object.entries(PLAN_DETAILS).map(([key, plan]) => (
                <div
                  key={key}
                  className={cn(
                    "p-3 rounded-xl border transition-colors",
                    key === subscription.plan
                      ? "border-[#4cd7f6]/30 bg-[#4cd7f6]/5"
                      : "border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-bold", plan.color)}>{plan.label}</span>
                    {key === subscription.plan && (
                      <span className="text-[10px] text-[#4cd7f6] font-bold">CURRENT</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{plan.features[0]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Usage & Invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Usage Overview */}
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#4cd7f6]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Token Usage</span>
              </div>
              <span className="text-xs text-slate-500">This billing cycle</span>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-2xl font-headline font-bold text-[#dae2fd]">
                  {totalTokens.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">of {subscription.tokenLimit.toLocaleString()} tokens</p>
              </div>
              <div>
                <p className="text-2xl font-headline font-bold text-[#4cd7f6]">
                  {usage.totalRequests.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">total requests</p>
              </div>
              <div>
                <p className="text-2xl font-headline font-bold text-[#dae2fd]">
                  {usagePercent}%
                </p>
                <p className="text-[10px] text-slate-500 mt-1">quota used</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-[#222a3d] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePercent > 90 ? "bg-[#ffb4ab]" : usagePercent > 70 ? "bg-amber-400" : "bg-[#4cd7f6]"
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-4 w-4 text-[#4cd7f6]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Daily Usage (Last 7 Days)</span>
            </div>

            {dailyUsage.length > 0 ? (
              <div className="flex items-end gap-2 h-32">
                {dailyUsage.map((day) => {
                  const total = day.totalIn + day.totalOut
                  const height = Math.max((total / maxDaily) * 100, 4)
                  const dateLabel = new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-500 font-mono">{total.toLocaleString()}</span>
                      <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
                        <div
                          className="w-full bg-[#4cd7f6]/60 rounded-t-lg transition-all hover:bg-[#4cd7f6] cursor-default"
                          style={{ height: `${height}%` }}
                          title={`${day.count} requests, ${total.toLocaleString()} tokens`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-600">{dateLabel}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-slate-500">
                No usage data yet
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#4cd7f6]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Invoices</span>
              </div>
            </div>
            {invoices.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Invoice</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Period</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tokens</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-xs font-mono text-[#4cd7f6]">{inv.number.slice(0, 12)}...</td>
                      <td className="px-6 py-3 text-xs text-slate-400">
                        {formatDate(inv.periodStart)} - {formatDate(inv.periodEnd)}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-300 font-mono">{inv.tokensUsed.toLocaleString()}</td>
                      <td className="px-6 py-3 text-xs text-[#dae2fd] font-bold">{formatCurrency(inv.amount, inv.currency)}</td>
                      <td className="px-6 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold", statusColor(inv.status))}>
                          {statusIcon(inv.status)}
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                No invoices yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
