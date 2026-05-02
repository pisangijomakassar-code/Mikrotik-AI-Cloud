"use client"

import { useState, useEffect, useCallback } from "react"
import { CreditCard, Zap, TrendingUp, FileText, Loader2, CheckCircle, Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLAN_LIMITS } from "@/lib/constants/plan-limits"

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: unknown) => void
          onPending?: (result: unknown) => void
          onError?: (result: unknown) => void
          onClose?: () => void
        }
      ) => void
    }
  }
}

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

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency }).format(amount / 100)
}

function formatPrice(priceIdr: number) {
  if (priceIdr === 0) return "Gratis"
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(priceIdr) + "/bln"
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function statusIcon(status: string) {
  switch (status) {
    case "PAID": return <CheckCircle className="h-3.5 w-3.5 text-tertiary" />
    case "PENDING": return <Clock className="h-3.5 w-3.5 text-amber-400" />
    case "OVERDUE": return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
    default: return <FileText className="h-3.5 w-3.5 text-slate-400" />
  }
}

function statusColor(status: string) {
  switch (status) {
    case "PAID": return "text-tertiary bg-tertiary/10"
    case "PENDING": return "text-amber-400 bg-amber-400/10"
    case "OVERDUE": return "text-destructive bg-destructive/10"
    default: return "text-slate-400 bg-slate-400/10"
  }
}

export default function PlanPage() {
  const [data, setData] = useState<PlanData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [snapReady, setSnapReady] = useState(false)

  // Load Midtrans Snap.js once
  useEffect(() => {
    const existing = document.getElementById("midtrans-snap")
    if (existing) { setSnapReady(true); return }

    const script = document.createElement("script")
    script.id = "midtrans-snap"
    script.src = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL ?? "https://app.sandbox.midtrans.com/snap/snap.js"
    script.setAttribute("data-client-key", process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "")
    script.onload = () => setSnapReady(true)
    document.head.appendChild(script)
  }, [])

  const fetchPlan = useCallback(() => {
    fetch("/api/plan")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  const handleUpgrade = async (plan: string) => {
    if (!snapReady || !window.snap) {
      alert("Payment gateway belum siap. Coba lagi sebentar.")
      return
    }
    setCheckoutLoading(plan)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? "Gagal memulai pembayaran")
        return
      }
      const { snapToken } = await res.json()
      window.snap.pay(snapToken, {
        onSuccess: () => {
          // Refresh data setelah bayar — webhook mungkin belum sampai, tapi invoice PENDING sudah ada
          fetchPlan()
        },
        onPending: () => { fetchPlan() },
        onError: (result) => { console.error("Snap error:", result) },
        onClose: () => { /* user tutup popup */ },
      })
    } catch {
      alert("Koneksi ke payment gateway gagal")
    } finally {
      setCheckoutLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { subscription, usage, dailyUsage, invoices } = data
  const planInfo = PLAN_LIMITS[subscription.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.FREE
  const usagePercent = subscription.tokenLimit === -1
    ? 0
    : subscription.tokenLimit > 0
      ? Math.min(Math.round(((usage.totalIn + usage.totalOut) / subscription.tokenLimit) * 100), 100)
      : 0
  const totalTokens = usage.totalIn + usage.totalOut

  const maxDaily = Math.max(...dailyUsage.map((d) => d.totalIn + d.totalOut), 1)

  const PLAN_ORDER = ["FREE", "PRO", "PREMIUM"]
  const currentPlanIdx = PLAN_ORDER.indexOf(subscription.plan)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Plan & Billing</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-[18px] w-[18px] text-primary shrink-0" />
            Manage your subscription and monitor usage.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Plan */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current Plan</span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase border",
                subscription.status === "ACTIVE"
                  ? "bg-tertiary/10 text-tertiary border-tertiary/20"
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
                  <CheckCircle className="h-3.5 w-3.5 text-tertiary shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            {subscription.plan !== "PREMIUM" && (
              <button
                onClick={() => handleUpgrade("PREMIUM")}
                disabled={!!checkoutLoading}
                className="w-full mt-6 py-2.5 rounded-lg text-xs font-bold bg-linear-to-r from-primary to-primary-container text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checkoutLoading === "PREMIUM" ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat...</>
                ) : "Upgrade ke Premium"}
              </button>
            )}
          </div>

          {/* All Plans */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Available Plans</span>
            <div className="mt-4 space-y-3">
              {Object.entries(PLAN_LIMITS).map(([key, plan]) => {
                const planIdx = PLAN_ORDER.indexOf(key)
                const isUpgrade = planIdx > currentPlanIdx
                const isCurrent = key === subscription.plan
                return (
                  <div
                    key={key}
                    className={cn(
                      "p-3 rounded-xl border transition-colors",
                      isCurrent
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/20 hover:border-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-bold", plan.color)}>{plan.label}</span>
                      {isCurrent ? (
                        <span className="text-[10px] text-primary font-bold">CURRENT</span>
                      ) : (
                        <span className="text-[10px] text-slate-500">{formatPrice(plan.priceIdr)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{plan.features[0]}</p>
                    {isUpgrade && !isCurrent && (
                      <button
                        onClick={() => handleUpgrade(key)}
                        disabled={!!checkoutLoading}
                        className="mt-2 w-full py-1.5 rounded-lg text-[10px] font-bold border border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        {checkoutLoading === key ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Memuat...</>
                        ) : `Pilih ${plan.label}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Usage & Invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Usage Overview */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Token Usage</span>
              </div>
              <span className="text-xs text-slate-500">Today&apos;s usage</span>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-2xl font-headline font-bold text-foreground">
                  {totalTokens.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  of {subscription.tokenLimit === -1 ? "∞" : subscription.tokenLimit.toLocaleString()} tokens/day
                </p>
              </div>
              <div>
                <p className="text-2xl font-headline font-bold text-primary">
                  {usage.totalRequests.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">total requests</p>
              </div>
              <div>
                <p className="text-2xl font-headline font-bold text-foreground">
                  {usagePercent}%
                </p>
                <p className="text-[10px] text-slate-500 mt-1">quota used</p>
              </div>
            </div>

            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePercent > 90 ? "bg-destructive" : usagePercent > 70 ? "bg-amber-400" : "bg-primary"
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-4 w-4 text-primary" />
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
                          className="w-full bg-primary/60 rounded-t-lg transition-all hover:bg-primary cursor-default"
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
          <div className="bg-surface-low rounded-2xl border border-border/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-border/20">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
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
                <tbody className="divide-y divide-border/20">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-xs font-mono text-primary">{inv.number.slice(0, 16)}…</td>
                      <td className="px-6 py-3 text-xs text-slate-400">
                        {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-300 font-mono">{inv.tokensUsed.toLocaleString()}</td>
                      <td className="px-6 py-3 text-xs text-foreground font-bold">{formatCurrency(inv.amount, inv.currency)}</td>
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
