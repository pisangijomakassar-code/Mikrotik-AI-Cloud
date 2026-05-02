"use client"

import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { format } from "date-fns"

interface LogEntry {
  id: string; timestamp: string; action: string; tool: string | null; status: string
  durationMs: number | null; errorMsg: string | null
  user: { email: string | null; name: string | null } | null
  router: { name: string } | null
  tenant: { name: string; slug: string }
}
interface PageResult { logs: LogEntry[]; total: number; page: number; totalPages: number }

export default function ErrorLogsPage() {
  const [result, setResult] = useState<PageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/system/errors?page=${page}`)
      if (res.ok) setResult(await res.json())
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
          <AlertTriangle className="h-7 w-7 text-red-400" /> Error Logs
        </h2>
        <p className="text-muted-foreground">
          {result ? `${result.total.toLocaleString()} error entries across all tenants` : "Loading…"}
        </p>
      </div>

      <div className="card-glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#869397] font-medium">Time</TableHead>
              <TableHead className="text-[#869397] font-medium">Tenant</TableHead>
              <TableHead className="text-[#869397] font-medium">User</TableHead>
              <TableHead className="text-[#869397] font-medium">Action</TableHead>
              <TableHead className="text-[#869397] font-medium">Error</TableHead>
              <TableHead className="text-[#869397] font-medium text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !result?.logs.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 text-[#4ae176]/50" />
                    <span>No errors found — system is clean</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              result.logs.map(log => (
                <TableRow key={log.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell className="text-xs font-mono text-[#869397] whitespace-nowrap">
                    {format(new Date(log.timestamp), "dd MMM HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold text-foreground">{log.tenant.name}</div>
                    <div className="text-[10px] text-[#869397] font-mono">{log.tenant.slug}</div>
                  </TableCell>
                  <TableCell className="text-xs text-[#869397]">
                    {log.user?.email ?? log.user?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">{log.action}</div>
                    {log.tool && <div className="text-[10px] text-[#869397] font-mono">{log.tool}</div>}
                  </TableCell>
                  <TableCell>
                    {log.errorMsg ? (
                      <span className="text-[10px] text-red-400 font-mono truncate max-w-[220px] block" title={log.errorMsg}>
                        {log.errorMsg}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400">{log.status}</span>
                    )}
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
