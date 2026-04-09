"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Sparkles,
} from "lucide-react"
import { useLogs } from "@/hooks/use-logs"
import type { LogFilter } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toISOString().split("T")[0]
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toISOString().split("T")[1]?.replace("Z", "").slice(0, 12) || ""
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "--"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function ActionBadge({ action }: { action: string }) {
  const base = "text-[9px] font-bold px-2 py-0.5 rounded-lg border"
  if (action === "read") {
    return (
      <span className={cn(base, "bg-slate-800 text-slate-400 border-white/5")}>
        READ
      </span>
    )
  }
  if (action === "write") {
    return (
      <span
        className={cn(
          base,
          "bg-cyan-950 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
        )}
      >
        WRITE
      </span>
    )
  }
  if (action === "admin") {
    return (
      <span
        className={cn(
          base,
          "bg-[#93000a]/20 text-[#ffb4ab] border-[#ffb4ab]/30 shadow-[0_0_10px_rgba(255,180,171,0.1)]"
        )}
      >
        ADMIN
      </span>
    )
  }
  return (
    <span className={cn(base, "bg-slate-800 text-slate-400 border-white/5")}>
      {action.toUpperCase()}
    </span>
  )
}

export function LogTable() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFilter, setDateFilter] = useState("")

  const filter: LogFilter = {
    page,
    pageSize: 20,
    action: actionFilter || undefined,
    status: statusFilter || undefined,
    from: dateFilter ? new Date(dateFilter) : undefined,
  }

  const { data, isLoading } = useLogs(filter)

  // Client-side search on user/tool/router/details
  const filteredLogs = data?.data?.filter((log) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (log.user?.name?.toLowerCase().includes(q) ?? false) ||
      (log.tool?.toLowerCase().includes(q) ?? false) ||
      (log.router?.name?.toLowerCase().includes(q) ?? false) ||
      (log.details?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-headline font-bold text-[#dae2fd]">
          Activity Logs
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Audit trail of all agent actions and admin overrides
        </p>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-[#131b2e] border-white/10 text-[#dae2fd] placeholder:text-slate-600 rounded-lg focus-visible:ring-[#4cd7f6]/50 focus-visible:border-[#4cd7f6]/50"
          />
        </div>

        {/* Action Filter */}
        <Select
          value={actionFilter || "all"}
          onValueChange={(v) => {
            setActionFilter(v === "all" ? "" : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[140px] h-9 bg-[#131b2e] border-white/10 text-[#dae2fd] rounded-lg">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10">
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="write">Write</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? "" : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[140px] h-9 bg-[#131b2e] border-white/10 text-[#dae2fd] rounded-lg">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Filter */}
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value)
            setPage(1)
          }}
          className="w-[160px] h-9 bg-[#131b2e] border-white/10 text-[#dae2fd] rounded-lg focus-visible:ring-[#4cd7f6]/50 focus-visible:border-[#4cd7f6]/50 [color-scheme:dark]"
        />
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.3)]"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-5">Timestamp</th>
                <th className="px-6 py-5">User</th>
                <th className="px-6 py-5">Router</th>
                <th className="px-6 py-5 text-center">Action</th>
                <th className="px-6 py-5">Tool</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !filteredLogs?.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#222a3d] flex items-center justify-center">
                        <Search className="h-5 w-5 text-slate-600" />
                      </div>
                      <p className="text-sm text-slate-400">No logs found</p>
                      <p className="text-[10px] text-slate-600">
                        {searchQuery ||
                        actionFilter ||
                        statusFilter ||
                        dateFilter
                          ? "Try adjusting your filters"
                          : "Logs will appear here as actions are performed"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={cn(
                      "transition-colors group hover:bg-white/[0.02]",
                      log.status === "error" && "hover:bg-[#ffb4ab]/5"
                    )}
                  >
                    {/* Timestamp */}
                    <td className="px-6 py-4">
                      <p className="text-xs font-mono-tech text-[#dae2fd]">
                        {formatDate(log.createdAt)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono-tech">
                        {formatTime(log.createdAt)}
                      </p>
                    </td>

                    {/* User */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center",
                            log.user?.name?.includes("AI") ||
                              log.user?.name?.includes("Agent")
                              ? "bg-[#4ae176]/20"
                              : "bg-[#2d3449]"
                          )}
                        >
                          {log.user?.name?.includes("AI") ||
                          log.user?.name?.includes("Agent") ? (
                            <Sparkles className="h-3 w-3 text-[#4ae176]" />
                          ) : (
                            <span className="text-[10px] font-bold text-[#4cd7f6]">
                              {(log.user?.name || "S")[0]}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[#dae2fd]">
                          {log.user?.name || "System"}
                        </span>
                      </div>
                    </td>

                    {/* Router */}
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono-tech text-cyan-400 px-2 py-1 bg-cyan-950/40 rounded-lg border border-cyan-900/30">
                        {log.router?.name || "--"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-center">
                      <ActionBadge action={log.action} />
                    </td>

                    {/* Tool */}
                    <td className="px-6 py-4">
                      <code
                        className={cn(
                          "text-xs font-mono-tech px-2 py-1 rounded bg-[#2d3449]",
                          log.status === "error"
                            ? "text-[#ffb4ab] bg-[#93000a]/10"
                            : "text-[#bcc9cd]"
                        )}
                      >
                        {log.tool || "--"}
                      </code>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            log.status === "success"
                              ? "bg-[#4ae176]"
                              : log.status === "error"
                                ? "bg-[#ffb4ab]"
                                : "bg-amber-400"
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs",
                            log.status === "error"
                              ? "text-[#ffb4ab] font-medium"
                              : "text-[#dae2fd]"
                          )}
                        >
                          {log.status === "success"
                            ? "Success"
                            : log.status === "error"
                              ? "Error"
                              : "Pending"}
                        </span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-mono-tech text-slate-400">
                        {formatDuration(log.duration)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.05] flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Showing{" "}
            <span className="text-[#dae2fd]">
              {filteredLogs?.length ?? 0}
            </span>{" "}
            of {data?.total ?? 0} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#4cd7f6] hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#4cd7f6] hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 mx-2">
              {data && data.totalPages > 0 && (
                <>
                  {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === data.totalPages ||
                        Math.abs(p - page) <= 1
                    )
                    .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                      if (idx > 0) {
                        const prev = arr[idx - 1]
                        if (p - prev > 1) acc.push("ellipsis")
                      }
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === "ellipsis" ? (
                        <span
                          key={`e-${idx}`}
                          className="px-1 text-slate-600 text-xs"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold transition-colors",
                            page === item
                              ? "bg-[#4cd7f6]/10 text-[#4cd7f6] border border-[#4cd7f6]/20"
                              : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                          )}
                        >
                          {item}
                        </button>
                      )
                    )}
                </>
              )}
            </div>
            <button
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#4cd7f6] hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data || page >= data.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#4cd7f6] hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => data && setPage(data.totalPages)}
              disabled={!data || page >= data.totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
