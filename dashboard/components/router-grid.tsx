"use client"

import { useState } from "react"
import { Router, MoreVertical, Users, ChevronLeft, ChevronRight, PlusCircle, Sparkles, Pencil, Trash2 } from "lucide-react"
import { useRouters, useDeleteRouter } from "@/hooks/use-routers"
import { AddRouterDialog } from "@/components/add-router-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function RouterGrid() {
  const deleteRouter = useDeleteRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [ownerFilter, setOwnerFilter] = useState("")
  const { data: routers, isLoading } = useRouters(search || undefined)

  const onlineCount = routers?.filter((r) => r.health?.status === "online").length ?? 0
  const totalCount = routers?.length ?? 0
  const healthPct = totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0

  function resetFilters() {
    setSearch("")
    setStatusFilter("")
    setOwnerFilter("")
  }

  const filteredRouters = routers?.filter((r) => !statusFilter || r.health?.status === statusFilter) ?? []

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex items-center gap-2 text-xs text-slate-500 mb-2 uppercase tracking-widest">
            <span>Infrastructure</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[#4cd7f6]">Routers</span>
          </nav>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight">All Managed Routers</h2>
          <p className="text-[#bcc9cd] mt-1">Real-time status monitoring for your global node network.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#131b2e] rounded-lg p-1 border border-white/5">
            <button className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#2d3449] text-[#4cd7f6]">Table View</button>
            <button className="px-4 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-[#dae2fd]">Map View</button>
          </div>
          <AddRouterDialog />
        </div>
      </div>

      {/* Filters - simple style matching log page */}
      <div className="flex items-center gap-3 mb-8">
        <Select value={statusFilter || "all"} onValueChange={(val) => setStatusFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[160px] bg-[#131b2e] border-white/5 text-xs rounded-lg">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ownerFilter || "all"} onValueChange={(val) => setOwnerFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[160px] bg-[#131b2e] border-white/5 text-xs rounded-lg">
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10">
            <SelectItem value="all">All Owners</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-[10px] text-slate-500 ml-auto flex items-center gap-2">
          <span className="relative flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#4ae176] rounded-full animate-pulse" />
            {onlineCount} Online
          </span>
          · Global Health {healthPct}%
        </span>
      </div>

      {/* Router Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Node Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Owner</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Endpoint</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">System</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-center">Resources</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Active</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded-lg bg-[#222a3d]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !filteredRouters.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Router className="mx-auto h-10 w-10 text-slate-500/50" />
                    <p className="mt-3 text-sm text-slate-400">No routers found</p>
                    <p className="text-xs text-slate-500">Add a router to get started</p>
                  </td>
                </tr>
              ) : (
                filteredRouters.map((router) => {
                  const health = router.health
                  const status: string = health?.status || "offline"
                  const isOffline = status === "offline"

                  return (
                    <tr
                      key={router.id}
                      className={cn(
                        "hover:bg-white/5 transition-colors group",
                        isOffline && "opacity-60"
                      )}
                    >
                      {/* Node Name */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl bg-[#2d3449] flex items-center justify-center border border-white/5",
                            isOffline ? "text-slate-500" : "text-[#4cd7f6]"
                          )}>
                            <Router className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#dae2fd]">{router.name}</p>
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                status === "online" ? "bg-[#4ae176]" : "bg-[#ffb4ab]"
                              )} />
                              <span className={cn(
                                "text-[10px] uppercase font-bold tracking-tighter",
                                status === "online" ? "text-[#4ae176]" : "text-[#ffb4ab]"
                              )}>
                                {status === "online" ? "Online" : "Offline"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-6 py-5">
                        <span className="text-xs font-medium text-slate-400">{router.user?.name || "Internal Ops"}</span>
                      </td>

                      {/* Endpoint */}
                      <td className="px-6 py-5">
                        <span className={cn(
                          "font-mono-tech text-xs px-2 py-1 rounded-lg",
                          isOffline
                            ? "text-slate-500 bg-slate-900/50"
                            : "text-[#4cd7f6] bg-[#06b6d4]/10"
                        )}>
                          {router.host}:{router.port}
                        </span>
                      </td>

                      {/* System */}
                      <td className="px-6 py-5">
                        {health && !isOffline ? (
                          <div>
                            <p className="text-xs text-[#dae2fd]">{health.board || "--"}</p>
                            <p className="text-[10px] text-slate-500 font-mono-tech">
                              {health.version ? `v${health.version} stable` : "--"}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-[#dae2fd]">--</p>
                            <p className="text-[10px] text-slate-500 font-mono-tech">--</p>
                          </div>
                        )}
                      </td>

                      {/* Resources - same data format as dashboard */}
                      <td className="px-6 py-5 min-w-[200px]">
                        {health && !isOffline ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>CPU</span>
                              <span className="font-mono-tech">{health.cpuLoad}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  health.cpuLoad > 80 ? "bg-[#ffb4ab]" : health.cpuLoad > 50 ? "bg-amber-400" : "bg-[#4cd7f6]"
                                )}
                                style={{ width: `${health.cpuLoad}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>MEM</span>
                              <span className="font-mono-tech">{health.memoryPercent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  health.memoryPercent > 80 ? "bg-[#ffb4ab]" : health.memoryPercent > 50 ? "bg-amber-400" : "bg-[#4ae176]"
                                )}
                                style={{ width: `${health.memoryPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>CPU</span>
                              <span className="font-mono-tech">--</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden" />
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>MEM</span>
                              <span className="font-mono-tech">--</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#2d3449] rounded-full overflow-hidden" />
                          </div>
                        )}
                      </td>

                      {/* Active */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-bold text-[#dae2fd]">
                            {health?.activeClients ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#4cd7f6] transition-colors flex items-center justify-center"
                            onClick={() => toast.info("Edit router coming soon")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <ConfirmDialog
                            trigger={
                              <button className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            }
                            title={`Delete router "${router.name}"?`}
                            description="This will permanently remove this router. The user will need to re-register it."
                            confirmText="Delete Router"
                            variant="destructive"
                            onConfirm={() => {
                              deleteRouter.mutate(router.id, {
                                onSuccess: () => toast.success("Router deleted"),
                                onError: (e) => toast.error(e.message),
                              })
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-xs text-slate-500">Showing {filteredRouters.length} of {totalCount} managed nodes</span>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-[#2d3449] rounded-lg disabled:opacity-30" disabled>
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-[#4cd7f6] text-[#003640] rounded-lg">1</button>
            </div>
            <button className="p-1 hover:bg-[#2d3449] rounded-lg">
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* AI Insight Overlay */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-panel p-6 rounded-3xl border border-[#4ae176]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <Sparkles className="h-5 w-5 text-[#4ae176] animate-pulse" />
          </div>
          <h3 className="font-headline font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
            AI Agent Insights
          </h3>
          <div className="space-y-4">
            <div className="bg-[#4ae176]/10 p-4 rounded-2xl border border-[#4ae176]/10">
              <p className="text-sm text-[#6bff8f] font-medium">
                Anomaly detected: CPU spikes correlate with unusual DNS traffic from specific clients. Suggesting firewall rule update.
              </p>
              <div className="mt-3 flex gap-3">
                <button className="text-[10px] uppercase font-bold tracking-widest text-[#003915] bg-[#4ae176] px-3 py-1.5 rounded-lg hover:brightness-110 transition-all">
                  Apply Suggestion
                </button>
                <button className="text-[10px] uppercase font-bold tracking-widest text-[#4ae176] border border-[#4ae176]/30 px-3 py-1.5 rounded-lg hover:bg-[#4ae176]/10 transition-all">
                  Review Logs
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[#222a3d] p-6 rounded-3xl border border-white/5 flex flex-col justify-between">
          <div>
            <h3 className="font-headline font-bold text-[#dae2fd] text-lg">System Health</h3>
            <p className="text-xs text-slate-500 mt-1">Average response time: 24ms</p>
          </div>
          <div className="mt-6 flex justify-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="64" cy="64" fill="none" r="56" stroke="#222a3d" strokeWidth="8" />
                <circle
                  cx="64"
                  cy="64"
                  fill="none"
                  r="56"
                  stroke="#4cd7f6"
                  strokeWidth="8"
                  strokeDasharray="351.8"
                  strokeDashoffset={351.8 * (1 - healthPct / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-headline font-bold text-[#dae2fd]">{healthPct}%</span>
                <span className="text-[8px] uppercase tracking-widest text-slate-500">Uptime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
