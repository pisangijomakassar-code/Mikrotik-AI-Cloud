"use client"

import { useState } from "react"
import { RefreshCw, Download, Info } from "lucide-react"
import { useRouterLogs } from "@/hooks/use-router-data"
import { useActiveRouter } from "@/components/active-router-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  parseHotspotMessage,
  formatHotspotMessage,
  getTopicStyle,
} from "@/lib/parse-hotspot-log"

export function LogTable() {
  const { activeRouter } = useActiveRouter()
  // Default to "voucher" filter — only login/logout/failed events.
  // Pakai "voucher" sebagai pseudo-topic; semua filter lain tetap matches via topics.includes.
  const [topicFilter, setTopicFilter] = useState("voucher")
  const [count, setCount] = useState(100)
  const { data, isLoading, refetch, isFetching } = useRouterLogs(
    activeRouter || undefined,
    count
  )

  const logs = data?.logs ?? []
  const filteredLogs = (() => {
    if (!topicFilter) return logs
    if (topicFilter === "voucher") {
      // Hanya event hotspot yang berhubungan dengan voucher (login/logout/failed).
      return logs.filter((l) => {
        const parsed = parseHotspotMessage(l.message)
        return parsed.kind !== null
      })
    }
    return logs.filter((l) => l.topics.includes(topicFilter))
  })()

  return (
    <div className="space-y-6">
      {/* Actions + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", isFetching && "animate-spin")} />
            Muat ulang
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
            <Download className="h-3.5 w-3.5 shrink-0" />
            Export
          </button>
        </div>
        <p className="text-xs text-muted-foreground/70">
          {data?.router ? `${data.router}` : "Semua router"} · {data?.total ?? 0} entri
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={topicFilter || "all"} onValueChange={(val) => setTopicFilter(val === "all" ? "" : val)}>
            <SelectTrigger className="w-[calc(50%-6px)] sm:w-[180px] bg-card border-border text-xs rounded-lg">
              <SelectValue placeholder="Semua topik" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="voucher">Voucher (login/logout/gagal)</SelectItem>
              <SelectItem value="hotspot">Semua event hotspot</SelectItem>
              <SelectItem value="all">Semua topik</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="firewall">Firewall</SelectItem>
              <SelectItem value="dhcp">DHCP</SelectItem>
              <SelectItem value="wireless">Wireless</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(count)} onValueChange={(val) => setCount(Number(val))}>
            <SelectTrigger className="w-[calc(50%-6px)] sm:w-[120px] bg-card border-border text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="50">50 terakhir</SelectItem>
              <SelectItem value="100">100 terakhir</SelectItem>
              <SelectItem value="200">200 terakhir</SelectItem>
              <SelectItem value="500">500 terakhir</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span className="text-[10px] text-muted-foreground/70 sm:ml-auto">
          Menampilkan {filteredLogs.length} dari {logs.length} entri · auto-refresh 10 detik
        </span>
      </div>

      {/* Log Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 md:px-6 py-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border w-32">Time</th>
                <th className="px-3 md:px-6 py-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border w-40 hidden md:table-cell">Topics</th>
                <th className="px-3 md:px-6 py-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 md:px-6 py-3"><div className="h-3 w-16 animate-pulse rounded bg-muted" /></td>
                    <td className="px-3 md:px-6 py-3 hidden md:table-cell"><div className="h-3 w-20 animate-pulse rounded bg-muted" /></td>
                    <td className="px-3 md:px-6 py-3"><div className="h-3 w-64 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : !filteredLogs.length ? (
                <tr>
                  <td colSpan={3} className="px-3 md:px-6 py-12 text-center">
                    <Info className="mx-auto h-8 w-8 text-muted-foreground/70 mb-3" />
                    <p className="text-sm text-muted-foreground">Tidak ada log</p>
                    <p className="text-[10px] text-muted-foreground/70">Belum ada event sesuai filter — coba ganti filter atau tambah router</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, i) => {
                  const parsed = parseHotspotMessage(log.message)
                  const style = getTopicStyle(log.topics, parsed)
                  const display = parsed.kind ? formatHotspotMessage(parsed, log.message) : log.message
                  // Pseudo-topic label "voucher" untuk parsed event, supaya kolom Topics tetap informatif.
                  const topicLabel = parsed.kind ? "voucher" : log.topics
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 md:px-6 py-3">
                        <span className="text-xs font-mono text-muted-foreground/70">{log.time}</span>
                      </td>
                      <td className="px-3 md:px-6 py-3 hidden md:table-cell">
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold", style.color, style.bg)}>
                          {style.icon}
                          {topicLabel}
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-3">
                        <span className="text-xs text-foreground font-mono-tech">{display}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
