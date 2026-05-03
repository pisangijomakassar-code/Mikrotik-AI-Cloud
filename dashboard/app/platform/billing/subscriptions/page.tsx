"use client"

import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TenantStatusBadge } from "@/components/platform/tenant-status-badge"
import { toast } from "sonner"
import { format } from "date-fns"

interface Sub {
  id: string
  plan: string
  status: string
  tokenLimit: number
  tokensUsed: number
  billingCycleStart: string
  billingCycleEnd: string | null
  createdAt: string
  tenant: { id: string; name: string; slug: string; status: string; _count: { routers: number } }
}

const PLANS = ["FREE", "PRO", "PREMIUM"]
const PLAN_LIMITS: Record<string, number> = { FREE: 100, PRO: 1000, PREMIUM: -1 }
const ROUTER_LIMITS: Record<string, number> = { FREE: 1, PRO: 3, PREMIUM: Infinity }

function planBadge(plan: string) {
  const colors: Record<string, string> = {
    FREE: "bg-zinc-500/15 text-zinc-400",
    PRO: "bg-[#4cd7f6]/15 text-[#4cd7f6]",
    PREMIUM: "bg-amber-500/15 text-amber-400",
  }
  return (
    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border border-transparent ${colors[plan] ?? "bg-zinc-500/15 text-zinc-400"}`}>
      {plan}
    </span>
  )
}

interface PendingChange { subId: string; plan: string; routerCount: number; routerLimit: number; tenantName: string }

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingChange | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/subscriptions")
      if (res.ok) setSubs(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function applyPlanChange(id: string, plan: string) {
    setUpdating(id)
    try {
      const tokenLimit = PLAN_LIMITS[plan] ?? 100
      const res = await fetch(`/api/platform/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, tokenLimit }),
      })
      if (res.ok) {
        const updated: Sub = await res.json()
        setSubs(prev => prev.map(s => s.id === id ? { ...updated, tenant: s.tenant } : s))
        toast.success(`Plan updated to ${plan}`)
      } else {
        toast.error("Failed to update plan")
      }
    } finally { setUpdating(null) }
  }

  function handlePlanSelect(sub: Sub, newPlan: string) {
    if (newPlan === sub.plan) return

    const currentLimit = ROUTER_LIMITS[sub.plan] ?? Infinity
    const newLimit = ROUTER_LIMITS[newPlan] ?? Infinity
    const routerCount = sub.tenant._count.routers

    if (newLimit < currentLimit && routerCount > newLimit) {
      setPending({ subId: sub.id, plan: newPlan, routerCount, routerLimit: newLimit, tenantName: sub.tenant.name })
      return
    }

    applyPlanChange(sub.id, newPlan)
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Subscriptions</h2>
        <p className="text-muted-foreground">
          {loading ? "Loading…" : `${subs.length} active subscription${subs.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="card-glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#869397] font-medium">Tenant</TableHead>
              <TableHead className="text-[#869397] font-medium">Status</TableHead>
              <TableHead className="text-[#869397] font-medium">Plan</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Token Limit</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Tokens Used</TableHead>
              <TableHead className="text-[#869397] font-medium">Cycle End</TableHead>
              <TableHead className="text-[#869397] font-medium">Change Plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : subs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No subscriptions found</TableCell></TableRow>
            ) : (
              subs.map((sub) => (
                <TableRow key={sub.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell>
                    <div className="font-semibold text-sm text-foreground">{sub.tenant.name}</div>
                    <div className="text-[11px] text-[#869397] font-mono">{sub.tenant.slug}</div>
                  </TableCell>
                  <TableCell><TenantStatusBadge status={sub.tenant.status} /></TableCell>
                  <TableCell>{planBadge(sub.plan)}</TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {sub.tokenLimit < 0 ? "∞" : sub.tokenLimit.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">{sub.tokensUsed.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-[#869397]">
                    {sub.billingCycleEnd ? format(new Date(sub.billingCycleEnd), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={sub.plan}
                      disabled={updating === sub.id}
                      onValueChange={(v) => handlePlanSelect(sub, v)}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANS.map(p => (
                          <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(v) => { if (!v) setPending(null) }}>
        <AlertDialogContent className="bg-[#0d1929] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-amber-400">⚠️ Router Limit Exceeded</AlertDialogTitle>
            <AlertDialogDescription className="text-[#869397] space-y-2">
              <span className="block">
                <strong className="text-foreground">{pending?.tenantName}</strong> currently has{" "}
                <strong className="text-foreground">{pending?.routerCount} router{(pending?.routerCount ?? 0) > 1 ? "s" : ""}</strong>,
                but plan <strong className="text-foreground">{pending?.plan}</strong> only allows{" "}
                <strong className="text-foreground">{pending?.routerLimit}</strong>.
              </span>
              <span className="block">
                Existing routers will remain active, but the tenant will not be able to add new routers until they are within the plan limit.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 text-black hover:bg-amber-400 font-semibold"
              onClick={() => {
                if (pending) applyPlanChange(pending.subId, pending.plan)
                setPending(null)
              }}
            >
              Downgrade Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
