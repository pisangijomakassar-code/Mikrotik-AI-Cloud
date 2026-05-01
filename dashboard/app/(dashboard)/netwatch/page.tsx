"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Eye, RefreshCw, Search, Wifi, WifiOff, Clock } from "lucide-react"
import { useActiveRouter } from "@/components/active-router-context"
import { apiClient } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface NetwatchItem {
  id?: string
  host?: string
  status?: string         // "up" | "down" | "unknown"
  comment?: string
  interval?: string
  timeout?: string
  "since"?: string        // sejak kapan status saat ini berlaku
  "down-script"?: string
  "up-script"?: string
  disabled?: string | boolean
}

interface NetwatchResponse {
  router: string
  items: NetwatchItem[]
}

export default function NetwatchPage() {
  const { activeRouter } = useActiveRouter()
  const [search, setSearch] = useState("")

  const query = useQuery<NetwatchResponse>({
    queryKey: ["netwatch", activeRouter ?? ""],
    queryFn: () => {
      const qs = activeRouter ? `?router=${encodeURIComponent(activeRouter)}` : ""
      return apiClient.get<NetwatchResponse>(`/api/netwatch${qs}`)
    },
    refetchInterval: 30_000,
    retry: false,
  })

  const items = query.data?.items ?? []
  const filtered = useMemo(() => {
    if (!search) return items
    const s = search.toLowerCase()
    return items.filter((i) =>
      (i.host ?? "").toLowerCase().includes(s) ||
      (i.comment ?? "").toLowerCase().includes(s)
    )
  }, [items, search])

  const upCount = items.filter((i) => i.status === "up").length
  const downCount = items.filter((i) => i.status === "down").length

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Eye className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold text-foreground">Netwatch</h1>
          </div>
          <p className="text-sm text-muted-foreground/70">
            Monitor host (AP, server, perangkat lain) yang dipasang di RouterOS via /tool/netwatch
          </p>
        </div>
        <button
          onClick={() => query.refetch()}
          className="card-glass rounded-xl px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon={<Wifi className="h-4 w-4 text-tertiary" />} label="Host UP" value={upCount} color="text-tertiary" />
        <SummaryCard icon={<WifiOff className="h-4 w-4 text-destructive" />} label="Host DOWN" value={downCount} color="text-destructive" />
        <SummaryCard icon={<Eye className="h-4 w-4 text-primary" />} label="Total" value={items.length} color="text-foreground" />
      </div>

      <div className="card-glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search host / comment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground/70">
            {query.data?.router && <>{query.data.router} · </>}
            {filtered.length} entri
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 text-left border-b border-border/30">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-24">Status</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Host / IP</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Comment</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-32">Interval</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-48">Sejak</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20 animate-pulse">
                    <td className="px-5 py-3"><div className="h-3 w-16 bg-muted rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-32 bg-muted rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-48 bg-muted rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-12 bg-muted rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-32 bg-muted rounded" /></td>
                  </tr>
                ))
              ) : query.isError ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-destructive">
                  Tidak bisa fetch netwatch dari router. Pastikan router online.
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  {items.length === 0
                    ? "Belum ada netwatch entry. Tambah lewat Winbox: /tool netwatch add host=<ip>"
                    : "Tidak ada hasil pencarian"}
                </td></tr>
              ) : (
                filtered.map((item, i) => {
                  const status = item.status || "unknown"
                  return (
                    <tr key={item.id ?? i} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="px-5 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-foreground">{item.host || "-"}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{item.comment || "-"}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground/70 font-mono">{item.interval || "-"}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground/70 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item["since"] ? new Date(item["since"]).toLocaleString("id-ID") : "-"}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/50 mt-4 text-center">
        Auto-refresh tiap 30 detik. Untuk add/edit netwatch entry, pakai Winbox langsung di router.
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === "up") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/10 text-tertiary">● UP</span>
  if (s === "down") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">● DOWN</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">● {status}</span>
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card-glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <p className={cn("text-2xl font-headline font-bold", color)}>{value}</p>
    </div>
  )
}
