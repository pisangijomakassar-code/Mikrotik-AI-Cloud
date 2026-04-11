"use client"

import { useState } from "react"
import { Router, Users, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react"
import { useRouters, useDeleteRouter } from "@/hooks/use-routers"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { TunnelStatusBadge } from "@/components/tunnel-status-badge"
import { TunnelManageDialog } from "@/components/tunnel-manage-dialog"
import type { TunnelStatus, TunnelMethod } from "@/lib/types"
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
    <div>
      {/* Filters - simple style matching log page */}
      <div className="flex items-center gap-3 mb-8">
        <Select value={statusFilter || "all"} onValueChange={(val) => setStatusFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[160px] bg-card border-border text-xs rounded-lg">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>

        <Select value={ownerFilter || "all"} onValueChange={(val) => setOwnerFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[160px] bg-card border-border text-xs rounded-lg">
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">All Owners</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-[10px] text-muted-foreground/70 ml-auto flex items-center gap-2">
          <span className="relative flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#4ae176] rounded-full animate-pulse" />
            {onlineCount} Online
          </span>
          · Global Health {healthPct}%
        </span>
      </div>

      {/* Router Table */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Node Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Owner</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Endpoint</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">System</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border text-center">Resources</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Active</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded-lg bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !filteredRouters.length ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Router className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 text-sm text-muted-foreground">No routers found</p>
                    <p className="text-xs text-muted-foreground/70">Add a router to get started</p>
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
                        "hover:bg-muted/40 transition-colors group",
                        isOffline && "opacity-60"
                      )}
                    >
                      {/* Node Name */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl bg-muted flex items-center justify-center border border-border",
                            isOffline ? "text-muted-foreground/70" : "text-primary"
                          )}>
                            <Router className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{router.name}</p>
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
                            {(router as { connectionMethod?: string }).connectionMethod === "TUNNEL" && (
                              <div className="mt-1">
                                <TunnelStatusBadge
                                  status={(router as { tunnel?: { status: TunnelStatus } }).tunnel?.status ?? null}
                                  method={(router as { tunnel?: { method: TunnelMethod } }).tunnel?.method}
                                  showMethod
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-6 py-5">
                        <span className="text-xs font-medium text-muted-foreground">{router.user?.name || "Internal Ops"}</span>
                      </td>

                      {/* Endpoint */}
                      <td className="px-6 py-5">
                        <span className={cn(
                          "font-mono-tech text-xs px-2 py-1 rounded-lg",
                          isOffline
                            ? "text-muted-foreground/70 bg-muted/50"
                            : "text-primary bg-[#06b6d4]/10"
                        )}>
                          {router.host}:{router.port}
                        </span>
                      </td>

                      {/* System */}
                      <td className="px-6 py-5">
                        {health && !isOffline ? (
                          <div>
                            <p className="text-xs text-foreground">{health.board || "--"}</p>
                            <p className="text-[10px] text-muted-foreground/70 font-mono-tech">
                              {health.version ? `v${health.version} stable` : "--"}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-foreground">--</p>
                            <p className="text-[10px] text-muted-foreground/70 font-mono-tech">--</p>
                          </div>
                        )}
                      </td>

                      {/* Resources - same data format as dashboard */}
                      <td className="px-6 py-5 min-w-[200px]">
                        {health && !isOffline ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>CPU</span>
                              <span className="font-mono-tech">{health.cpuLoad}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  health.cpuLoad > 80 ? "bg-[#ffb4ab]" : health.cpuLoad > 50 ? "bg-amber-400" : "bg-primary"
                                )}
                                style={{ width: `${health.cpuLoad}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>MEM</span>
                              <span className="font-mono-tech">{health.memoryPercent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
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
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>CPU</span>
                              <span className="font-mono-tech">--</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" />
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>MEM</span>
                              <span className="font-mono-tech">--</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" />
                          </div>
                        )}
                      </td>

                      {/* Active */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground/70" />
                          <span className="text-sm font-bold text-foreground">
                            {health?.activeClients ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(router as { connectionMethod?: string }).connectionMethod === "TUNNEL" && (
                            <TunnelManageDialog
                              routerId={router.id}
                              routerName={router.name}
                              tunnelMethod={((router as { tunnel?: { method: TunnelMethod } }).tunnel?.method) ?? "CLOUDFLARE"}
                              tunnelStatus={(router as { tunnel?: { status: TunnelStatus } }).tunnel?.status ?? null}
                            />
                          )}
                          <button
                            className="w-8 h-8 rounded-lg hover:bg-muted/40 text-muted-foreground/70 hover:text-primary transition-colors flex items-center justify-center"
                            onClick={() => toast.info("Edit router coming soon")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <ConfirmDialog
                            trigger={
                              <button className="w-8 h-8 rounded-lg hover:bg-muted/40 text-muted-foreground/70 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
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
        <div className="px-6 py-4 bg-muted/50 flex items-center justify-between border-t border-border">
          <span className="text-xs text-muted-foreground/70">Showing {filteredRouters.length} of {totalCount} managed nodes</span>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-muted rounded-lg disabled:opacity-30" disabled>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground rounded-lg">1</button>
            </div>
            <button className="p-1 hover:bg-muted rounded-lg">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
