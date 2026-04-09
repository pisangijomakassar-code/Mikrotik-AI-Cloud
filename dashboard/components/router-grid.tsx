"use client"

import { useState } from "react"
import { Search, Router, MoreHorizontal, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRouters } from "@/hooks/use-routers"
import { AddRouterDialog } from "@/components/add-router-dialog"
import { cn } from "@/lib/utils"

function ResourceBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-8">{label}</span>
      <div className="h-1.5 w-16 rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct < 60 ? "bg-[#4ae176]" : pct < 85 ? "bg-amber-400" : "bg-[#ffb4ab]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-foreground w-7 text-right">{pct}%</span>
    </div>
  )
}

export function RouterGrid() {
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

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.4)]" />
          <span className="text-sm text-foreground font-medium">{onlineCount} Nodes Online</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Global Health <span className="text-[#4ae176] font-semibold">{healthPct}%</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search routers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-0"
              style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border-0 px-3 text-sm text-foreground outline-none"
            style={{ background: 'rgba(45, 52, 73, 0.6)' }}
          >
            <option value="">Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="h-9 rounded-md border-0 px-3 text-sm text-foreground outline-none"
            style={{ background: 'rgba(45, 52, 73, 0.6)' }}
          >
            <option value="">Owner</option>
          </select>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
        <AddRouterDialog />
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent" style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Node Name</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Owner</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Endpoint</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">System</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Resources</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider text-muted-foreground">Connections</TableHead>
              <TableHead className="w-10 text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !routers?.length ? (
              <TableRow style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Router className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">No routers found</p>
                  <p className="text-xs text-muted-foreground/70">Add a router to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              routers
                .filter((r) => !statusFilter || r.health?.status === statusFilter)
                .map((router) => {
                  const health = router.health
                  const status: string = health?.status || "offline"
                  const memPct = health ? Math.round((health.memoryUsed / health.memoryTotal) * 100) : 0

                  return (
                    <TableRow
                      key={router.id}
                      className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}
                    >
                      {/* Node Name */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "inline-block h-2 w-2 rounded-full shrink-0",
                              status === "online" && "bg-[#4ae176] shadow-[0_0_6px_rgba(74,225,118,0.4)]",
                              status === "offline" && "bg-[#ffb4ab]",
                              status === "warning" && "bg-amber-400"
                            )}
                          />
                          <span className="text-sm font-medium text-foreground">{router.name}</span>
                        </div>
                      </TableCell>

                      {/* Owner */}
                      <TableCell className="text-sm text-muted-foreground">
                        {router.user?.name || "--"}
                      </TableCell>

                      {/* Endpoint */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-technical)' }}>
                          {router.host}:{router.port}
                        </span>
                      </TableCell>

                      {/* System */}
                      <TableCell>
                        {health && status !== "offline" ? (
                          <div className="space-y-0.5">
                            {health.board && (
                              <span className="text-xs text-foreground">{health.board}</span>
                            )}
                            {health.version && (
                              <div>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/50">
                                  v{health.version}
                                </Badge>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>

                      {/* Resources */}
                      <TableCell>
                        {health && status !== "offline" ? (
                          <div className="space-y-1">
                            <ResourceBar value={health.cpuLoad} max={100} label="CPU" />
                            <ResourceBar value={health.memoryUsed} max={health.memoryTotal} label="MEM" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>

                      {/* Active Connections */}
                      <TableCell className="text-center">
                        {health && status !== "offline" ? (
                          <span className="text-sm text-foreground">{health.activeClients}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
            )}
          </TableBody>
        </Table>

        {/* Pagination footer */}
        {routers && routers.length > 0 && (
          <div className="px-4 py-3 text-xs text-muted-foreground" style={{ borderTop: '1px solid rgba(61, 73, 76, 0.15)' }}>
            Showing {routers.filter((r) => !statusFilter || r.health?.status === statusFilter).length} of {totalCount} managed nodes
          </div>
        )}
      </div>
    </div>
  )
}
