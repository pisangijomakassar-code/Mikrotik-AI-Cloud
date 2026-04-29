"use client"

import { useState } from "react"
import { AlertTriangle, Info, Shield, Wifi, RefreshCw, Download, LogIn, LogOut, KeyRound, Ticket } from "lucide-react"
import { useRouterLogs } from "@/hooks/use-router-data"
import { useRouters } from "@/hooks/use-routers"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ParsedHotspotLog {
  /** "login" | "logout" | "login-failed" | null when not a hotspot event */
  kind: "login" | "logout" | "login-failed" | null
  username: string
  reason?: string
}

// Parse a MikroTik hotspot log message into a structured record.
// MikroTik formats observed:
//   "user xxx logged in"                                  → login
//   "logged in (mac=AA:BB:CC..)"                          → login
//   "user xxx logged out (lease-expired|user-logout|...)" → logout
//   "user xxx login failed: invalid username or password" → login-failed
//   "vc1234: login failed: ..."                           → login-failed
function parseHotspotMessage(msg: string): ParsedHotspotLog {
  const lower = msg.toLowerCase()
  const failedMatch = msg.match(/(?:user\s+)?["']?([^"',:\s]+)["']?[:\s].*login\s+failed(?:[:\s]+(.+?))?$/i)
  if (failedMatch) {
    return { kind: "login-failed", username: failedMatch[1], reason: failedMatch[2]?.trim() }
  }
  if (lower.includes("logged in") || lower.includes("login ok") || lower.includes("login")) {
    if (lower.includes("logged in") || lower.includes("login ok")) {
      const m = msg.match(/(?:user\s+)?["']?([^"',:\s]+)["']?\s+(?:->\s*)?logged in/i)
      return { kind: "login", username: m?.[1] ?? "" }
    }
  }
  if (lower.includes("logged out")) {
    const m = msg.match(/(?:user\s+)?["']?([^"',:\s]+)["']?\s+(?:->\s*)?logged out(?:\s*\(([^)]+)\))?/i)
    return { kind: "logout", username: m?.[1] ?? "", reason: m?.[2] }
  }
  return { kind: null, username: "" }
}

function getTopicStyle(topics: string, parsed: ParsedHotspotLog) {
  if (parsed.kind === "login")
    return { icon: <LogIn className="h-3 w-3" />, color: "text-tertiary", bg: "bg-[#4ae176]/10" }
  if (parsed.kind === "logout")
    return { icon: <LogOut className="h-3 w-3" />, color: "text-muted-foreground", bg: "bg-muted/40" }
  if (parsed.kind === "login-failed")
    return { icon: <KeyRound className="h-3 w-3" />, color: "text-destructive", bg: "bg-[#ffb4ab]/10" }
  if (topics.includes("error") || topics.includes("critical"))
    return { icon: <AlertTriangle className="h-3 w-3" />, color: "text-destructive", bg: "bg-[#ffb4ab]/10" }
  if (topics.includes("warning"))
    return { icon: <AlertTriangle className="h-3 w-3" />, color: "text-amber-400", bg: "bg-amber-400/10" }
  if (topics.includes("firewall"))
    return { icon: <Shield className="h-3 w-3" />, color: "text-primary", bg: "bg-primary/10" }
  if (topics.includes("hotspot"))
    return { icon: <Ticket className="h-3 w-3" />, color: "text-primary", bg: "bg-primary/10" }
  if (topics.includes("wireless") || topics.includes("dhcp"))
    return { icon: <Wifi className="h-3 w-3" />, color: "text-tertiary", bg: "bg-[#4ae176]/10" }
  return { icon: <Info className="h-3 w-3" />, color: "text-muted-foreground", bg: "bg-muted/40" }
}

function formatHotspotMessage(parsed: ParsedHotspotLog, original: string): string {
  if (parsed.kind === "login")        return `voucher ${parsed.username} login`
  if (parsed.kind === "logout") {
    return parsed.reason
      ? `voucher ${parsed.username} logout (${parsed.reason})`
      : `voucher ${parsed.username} logout`
  }
  if (parsed.kind === "login-failed") {
    return parsed.reason
      ? `voucher ${parsed.username} gagal login: ${parsed.reason}`
      : `voucher ${parsed.username} gagal login`
  }
  return original
}

export function LogTable() {
  const [selectedRouter, setSelectedRouter] = useState("")
  // Default to "voucher" filter — only login/logout/failed events.
  // Pakai "voucher" sebagai pseudo-topic; semua filter lain tetap matches via topics.includes.
  const [topicFilter, setTopicFilter] = useState("voucher")
  const [count, setCount] = useState(100)
  const { data: routers } = useRouters()
  const { data, isLoading, refetch, isFetching } = useRouterLogs(
    selectedRouter || undefined,
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
          <Select value={selectedRouter || "default"} onValueChange={(val) => setSelectedRouter(val === "default" ? "" : val)}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card border-border text-xs rounded-lg">
              <SelectValue placeholder="Router default" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="default">Router default</SelectItem>
              {routers?.map((r) => (
                <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
