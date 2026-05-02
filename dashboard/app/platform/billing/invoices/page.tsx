"use client"

import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"

interface Invoice {
  id: string; number: string; status: string; amount: number; currency: string
  periodStart: string; periodEnd: string; tokensUsed: number; paidAt: string | null
  createdAt: string; tenant: { id: string; name: string; slug: string }
}
interface PageResult { invoices: Invoice[]; total: number; page: number; totalPages: number }

const STATUSES = ["ALL", "DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELED"]

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    PAID: "bg-[#4ae176]/15 text-[#4ae176]",
    PENDING: "bg-amber-500/15 text-amber-400",
    OVERDUE: "bg-red-500/15 text-red-400",
    DRAFT: "bg-zinc-500/15 text-zinc-400",
    CANCELED: "bg-zinc-500/10 text-zinc-500",
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colors[status] ?? "bg-zinc-500/15 text-zinc-400"}`}>
      {status}
    </span>
  )
}

function fmtAmount(amount: number, currency: string) {
  if (currency === "IDR") return `Rp ${amount.toLocaleString("id-ID")}`
  return `${currency} ${(amount / 100).toFixed(2)}`
}

export default function InvoicesPage() {
  const [result, setResult] = useState<PageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("ALL")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (status !== "ALL") params.set("status", status)
      const res = await fetch(`/api/platform/invoices?${params}`)
      if (res.ok) setResult(await res.json())
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Invoices</h2>
        <p className="text-muted-foreground">
          {result ? `${result.total.toLocaleString()} invoices across all tenants` : "Loading…"}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="card-glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#869397] font-medium">Invoice #</TableHead>
              <TableHead className="text-[#869397] font-medium">Tenant</TableHead>
              <TableHead className="text-[#869397] font-medium">Status</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Amount</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Tokens</TableHead>
              <TableHead className="text-[#869397] font-medium">Period</TableHead>
              <TableHead className="text-[#869397] font-medium">Paid At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !result?.invoices.length ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No invoices found</TableCell></TableRow>
            ) : (
              result.invoices.map(inv => (
                <TableRow key={inv.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell className="text-xs font-mono text-[#4cd7f6]">{inv.number.slice(-8).toUpperCase()}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-foreground">{inv.tenant.name}</div>
                    <div className="text-[11px] text-[#869397] font-mono">{inv.tenant.slug}</div>
                  </TableCell>
                  <TableCell>{statusBadge(inv.status)}</TableCell>
                  <TableCell className="text-right text-sm font-mono text-foreground">{fmtAmount(inv.amount, inv.currency)}</TableCell>
                  <TableCell className="text-right text-xs font-mono text-[#869397]">{inv.tokensUsed.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-[#869397]">
                    {format(new Date(inv.periodStart), "dd MMM")} – {format(new Date(inv.periodEnd), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-xs text-[#869397]">
                    {inv.paidAt ? format(new Date(inv.paidAt), "dd MMM yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {result && result.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-xs text-muted-foreground">Page {result.page} of {result.totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= result.totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
