"use client"

import { useState } from "react"
import { Download, RefreshCw, Sparkles, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wand2 } from "lucide-react"
import { useLogs } from "@/hooks/use-logs"
import type { LogFilter } from "@/lib/types"
import { cn } from "@/lib/utils"

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
    return <span className={cn(base, "bg-slate-800 text-slate-400 border-white/5")}>READ</span>
  }
  if (action === "write") {
    return <span className={cn(base, "bg-cyan-950 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]")}>WRITE</span>
  }
  if (action === "admin") {
    return <span className={cn(base, "bg-[#93000a]/20 text-[#ffb4ab] border-[#ffb4ab]/30 shadow-[0_0_10px_rgba(255,180,171,0.1)]")}>ADMIN</span>
  }
  return <span className={cn(base, "bg-slate-800 text-slate-400 border-white/5")}>{action.toUpperCase()}</span>
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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#4cd7f6]" />
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-tighter">System Telemetry</span>
          </div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd]">Activity Logs</h2>
          <p className="text-[#bcc9cd] mt-2 max-w-xl">
            Real-time audit trails of all autonomous agent actions and manual administrator overrides across the MikroTik network architecture.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#222a3d] rounded-lg border border-[#3d494c]/20 text-[#dae2fd] hover:bg-[#2d3449] transition-colors">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-bold rounded-lg shadow-lg shadow-cyan-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <RefreshCw className="h-4 w-4" />
            Live Stream
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#131b2e] rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Operator</label>
          <div className="relative">
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
              className="w-full bg-[#2d3449] text-[#dae2fd] text-sm border-none rounded-lg py-2.5 pl-3 pr-10 appearance-none focus:ring-1 focus:ring-cyan-400 cursor-pointer outline-none"
            >
              <option value="">All Users</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Infrastructure</label>
          <div className="relative">
            <select className="w-full bg-[#2d3449] text-[#dae2fd] text-sm border-none rounded-lg py-2.5 pl-3 pr-10 appearance-none focus:ring-1 focus:ring-cyan-400 cursor-pointer outline-none">
              <option>All Routers</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Action Tier</label>
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
              className="w-full bg-[#2d3449] text-[#dae2fd] text-sm border-none rounded-lg py-2.5 pl-3 pr-10 appearance-none focus:ring-1 focus:ring-cyan-400 cursor-pointer outline-none"
            >
              <option value="">All Actions</option>
              <option value="read">Read</option>
              <option value="write">Write</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Status</label>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full bg-[#2d3449] text-[#dae2fd] text-sm border-none rounded-lg py-2.5 pl-3 pr-10 appearance-none focus:ring-1 focus:ring-cyan-400 cursor-pointer outline-none"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#222a3d]/50 border-b border-white/5">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Tier</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Execution / Tool</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Lat.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !data?.data?.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No logs found
                  </td>
                </tr>
              ) : (
                data.data.map((log, index) => (
                  <tr
                    key={log.id}
                    className={cn(
                      "transition-colors group",
                      log.status === "error"
                        ? "hover:bg-[#ffb4ab]/5"
                        : "hover:bg-cyan-400/5",
                      index % 2 === 1 && "bg-[#131b2e]/50"
                    )}
                  >
                    {/* Timestamp */}
                    <td className="px-6 py-4">
                      <p className="text-xs font-mono-tech text-[#dae2fd]">{formatDate(log.createdAt)}</p>
                      <p className="text-[10px] text-slate-500 font-mono-tech">{formatTime(log.createdAt)}</p>
                    </td>

                    {/* Identity */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          log.user?.name?.includes("AI") || log.user?.name?.includes("Agent")
                            ? "bg-[#4ae176]/20"
                            : "bg-slate-800"
                        )}>
                          {log.user?.name?.includes("AI") || log.user?.name?.includes("Agent") ? (
                            <Sparkles className="h-3 w-3 text-[#4ae176]" />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">
                              {(log.user?.name || "S")[0]}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[#dae2fd]">{log.user?.name || "System"}</span>
                      </div>
                    </td>

                    {/* Asset */}
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono-tech text-cyan-400 px-2 py-1 bg-cyan-950/40 rounded-lg border border-cyan-900/30">
                        {log.router?.name || "--"}
                      </span>
                    </td>

                    {/* Tier */}
                    <td className="px-6 py-4 text-center">
                      <ActionBadge action={log.action} />
                    </td>

                    {/* Tool */}
                    <td className="px-6 py-4">
                      <code className={cn(
                        "text-xs font-mono-tech px-2 py-1 rounded bg-[#2d3449]",
                        log.status === "error"
                          ? "text-[#ffb4ab] bg-[#93000a]/10"
                          : "text-[#bcc9cd]"
                      )}>
                        {log.tool || "--"}
                      </code>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          log.status === "success" ? "bg-[#4ae176]" :
                          log.status === "error" ? "bg-[#ffb4ab]" :
                          "bg-amber-400"
                        )} />
                        <span className={cn(
                          "text-xs",
                          log.status === "error" ? "text-[#ffb4ab] font-medium" : "text-[#dae2fd]"
                        )}>
                          {log.status === "success" ? "Success" :
                           log.status === "error" ? "Auth Fail" :
                           "Pending"}
                        </span>
                      </div>
                    </td>

                    {/* Latency */}
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-mono-tech text-slate-400">{formatDuration(log.duration)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-[#222a3d]/30 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Showing <span className="text-[#dae2fd] font-bold">{data?.data?.length ?? 0}</span> of {data?.total ?? 0} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 mx-2">
              <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">{page}</span>
              {data && data.totalPages > 1 && page < data.totalPages && (
                <button
                  className="px-3 py-1 rounded-lg text-slate-500 text-xs hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => setPage(page + 1)}
                >
                  {page + 1}
                </button>
              )}
            </div>
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data || page >= data.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
              onClick={() => data && setPage(data.totalPages)}
              disabled={!data || page >= data.totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bento Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-[#131b2e] to-[#060e20] border border-white/5 flex items-center justify-between">
          <div className="space-y-4">
            <h3 className="text-lg font-headline font-bold text-[#dae2fd]">AI Log Synthesis</h3>
            <p className="text-sm text-[#bcc9cd] leading-relaxed">
              The agent has identified <span className="text-cyan-400 font-bold">duplicate Read events</span> in the last hour. These were aggregated to reduce storage footprint. No suspicious traffic patterns detected.
            </p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ae176]" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Normal Activity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Optimized Storage</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:block relative w-32 h-32">
            <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-2xl" />
            <Wand2 className="h-16 w-16 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-[#131b2e] border border-white/5 group hover:border-cyan-500/30 transition-all duration-500">
          <div className="flex justify-between items-start mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-[10px] font-bold text-[#ffb4ab] bg-[#93000a]/20 px-2 py-0.5 rounded-lg">High Alert</span>
          </div>
          <h3 className="text-md font-bold text-[#dae2fd] mb-2">Auth Failures</h3>
          <p className="text-xs text-[#bcc9cd] mb-4">Detected failed attempts from unknown subnet.</p>
          <button className="w-full py-2 text-xs font-bold text-cyan-400 border border-cyan-400/20 rounded-lg hover:bg-cyan-400 hover:text-[#003640] transition-all">
            Review Security Log
          </button>
        </div>
      </div>
    </div>
  )
}
