"use client"

import { useState } from "react"
import { Search, Filter, CheckCircle2, XCircle, Clock } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLogs } from "@/hooks/use-logs"
import type { LogFilter } from "@/lib/types"
import { cn } from "@/lib/utils"

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px]",
        status === "success" && "border-emerald-500/30 text-emerald-400",
        status === "error" && "border-red-500/30 text-red-400",
        status === "pending" && "border-amber-500/30 text-amber-400"
      )}
    >
      {status === "success" && <CheckCircle2 className="h-3 w-3" />}
      {status === "error" && <XCircle className="h-3 w-3" />}
      {status === "pending" && <Clock className="h-3 w-3" />}
      {status}
    </Badge>
  )
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "--"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function LogTable() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [userFilter, setUserFilter] = useState("")

  const filter: LogFilter = {
    page,
    pageSize: 20,
    action: actionFilter || undefined,
    status: statusFilter || undefined,
    userId: userFilter || undefined,
  }

  const { data, isLoading } = useLogs(filter)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by user ID..."
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value)
              setPage(1)
            }}
            className="pl-9 bg-card border-border"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        >
          <option value="">All Actions</option>
          <option value="read">Read</option>
          <option value="write">Write</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>
        {(actionFilter || statusFilter || userFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter("")
              setStatusFilter("")
              setUserFilter("")
              setPage(1)
            }}
            className="gap-1 text-muted-foreground"
          >
            <Filter className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Router</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data?.data?.length ? (
              <TableRow className="border-border">
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((log) => (
                <TableRow
                  key={log.id}
                  className="border-border hover:bg-accent/30"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatTimestamp(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {log.user?.name || "System"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.router?.name || "--"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        log.action === "read" && "border-blue-500/30 text-blue-400",
                        log.action === "write" && "border-amber-500/30 text-amber-400",
                        log.action === "admin" && "border-purple-500/30 text-purple-400"
                      )}
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.tool || "--"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {formatDuration(log.duration)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total} total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
