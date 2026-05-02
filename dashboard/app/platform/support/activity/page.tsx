"use client"

import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"

interface Tenant { id: string; name: string; slug: string }
interface LogEntry {
  id: string
  timestamp: string
  action: string
  tool: string | null
  status: string
  durationMs: number | null
  errorMsg: string | null
  user: { email: string | null; name: string | null } | null
  router: { name: string } | null
}
interface PageResult {
  logs: LogEntry[]
  total: number
  page: number
  totalPages: number
}

export default function TenantActivityPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantId, setTenantId] = useState<string>("all")
  const [result, setResult] = useState<PageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  // Load tenant list
  useEffect(() => {
    fetch("/api/platform/tenants").then(r => r.json()).then(setTenants)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (tenantId !== "all") params.set("tenantId", tenantId)
      const res = await fetch(`/api/platform/audit?${params}`)
      if (res.ok) setResult(await res.json())
    } finally { setLoading(false) }
  }, [page, tenantId])

  useEffect(() => { load() }, [load])

  const selectedTenant = tenants.find(t => t.id === tenantId)

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Tenant Activity</h2>
        <p className="text-muted-foreground">
          {selectedTenant
            ? `Showing activity for ${selectedTenant.name}`
            : "Activity log across all tenants — for support debugging"}
        </p>
      </div>

      {/* Tenant selector */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={tenantId} onValueChange={(v) => { setTenantId(v); setPage(1) }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select tenant…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tenants</SelectItem>
            {tenants.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {result && (
          <span className="text-xs text-muted-foreground">
            {result.total.toLocaleString()} entries
          </span>
        )}
      </div>

      <div className="card-glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#869397] font-medium">Time</TableHead>
              <TableHead className="text-[#869397] font-medium">User</TableHead>
              <TableHead className="text-[#869397] font-medium">Action</TableHead>
              <TableHead className="text-[#869397] font-medium">Router</TableHead>
              <TableHead className="text-[#869397] font-medium">Status</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !result?.logs.length ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No activity logs found</TableCell></TableRow>
            ) : (
              result.logs.map((log) => (
                <TableRow key={log.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell className="text-xs font-mono text-[#869397] whitespace-nowrap">
                    {format(new Date(log.timestamp), "dd MMM HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-xs text-[#869397]">
                    {log.user?.email ?? log.user?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">{log.action}</div>
                    {log.tool && <div className="text-[10px] text-[#869397] font-mono">{log.tool}</div>}
                    {log.errorMsg && <div className="text-[10px] text-red-400 truncate max-w-[180px]" title={log.errorMsg}>{log.errorMsg}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-[#869397]">{log.router?.name ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      log.status === "success" ? "bg-[#4ae176]/15 text-[#4ae176]" : "bg-red-500/15 text-red-400"
                    }`}>
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-[#869397]">
                    {log.durationMs != null ? `${log.durationMs}ms` : "—"}
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
