"use client"

import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { format } from "date-fns"

interface LogEntry {
  id: string
  timestamp: string
  action: string
  tool: string | null
  status: string
  durationMs: number | null
  details: string | null
  errorMsg: string | null
  user: { email: string | null; name: string | null } | null
  router: { name: string } | null
  tenant: { id: string; name: string; slug: string } | null
}

interface PageResult {
  logs: LogEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function AuditLogPage() {
  const [result, setResult] = useState<PageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/platform/audit?${params}`)
      if (res.ok) setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Audit Log</h2>
        <p className="text-muted-foreground">
          {result ? `${result.total.toLocaleString()} entries across all tenants` : "Loading…"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search actions…" className="pl-9" disabled />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-glass rounded-2xl p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#869397] font-medium">Time</TableHead>
              <TableHead className="text-[#869397] font-medium">Tenant</TableHead>
              <TableHead className="text-[#869397] font-medium">User</TableHead>
              <TableHead className="text-[#869397] font-medium">Action</TableHead>
              <TableHead className="text-[#869397] font-medium">Status</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : !result?.logs.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No activity logs found</TableCell>
              </TableRow>
            ) : (
              result.logs.map((log) => (
                <TableRow key={log.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell className="text-xs font-mono text-[#869397] whitespace-nowrap">
                    {format(new Date(log.timestamp), "dd MMM HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    {log.tenant ? (
                      <div>
                        <div className="text-xs font-semibold text-foreground">{log.tenant.name}</div>
                        <div className="text-[10px] text-[#869397] font-mono">{log.tenant.slug}</div>
                      </div>
                    ) : <span className="text-[#869397]">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-[#869397]">
                    {log.user?.email ?? log.user?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">{log.action}</div>
                    {log.tool && <div className="text-[10px] text-[#869397] font-mono">{log.tool}</div>}
                    {log.errorMsg && <div className="text-[10px] text-red-400 truncate max-w-[200px]">{log.errorMsg}</div>}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      log.status === "success"
                        ? "bg-[#4ae176]/15 text-[#4ae176]"
                        : "bg-red-500/15 text-red-400"
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

        {/* Pagination */}
        {result && result.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-xs text-muted-foreground">
              Page {result.page} of {result.totalPages}
            </span>
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
