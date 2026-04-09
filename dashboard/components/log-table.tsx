"use client"

import { useState } from "react"
import { AlertTriangle, Info, Shield, Wifi, RefreshCw, Download } from "lucide-react"
import { useRouterLogs } from "@/hooks/use-router-data"
import { useRouters } from "@/hooks/use-routers"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

function getTopicStyle(topics: string) {
  if (topics.includes("error") || topics.includes("critical"))
    return { icon: <AlertTriangle className="h-3 w-3" />, color: "text-[#ffb4ab]", bg: "bg-[#ffb4ab]/10" }
  if (topics.includes("warning"))
    return { icon: <AlertTriangle className="h-3 w-3" />, color: "text-amber-400", bg: "bg-amber-400/10" }
  if (topics.includes("firewall"))
    return { icon: <Shield className="h-3 w-3" />, color: "text-[#4cd7f6]", bg: "bg-[#4cd7f6]/10" }
  if (topics.includes("wireless") || topics.includes("dhcp"))
    return { icon: <Wifi className="h-3 w-3" />, color: "text-[#4ae176]", bg: "bg-[#4ae176]/10" }
  return { icon: <Info className="h-3 w-3" />, color: "text-slate-400", bg: "bg-slate-400/10" }
}

export function LogTable() {
  const [selectedRouter, setSelectedRouter] = useState("")
  const [topicFilter, setTopicFilter] = useState("")
  const [count, setCount] = useState(100)
  const { data: routers } = useRouters()
  const { data, isLoading, refetch, isFetching } = useRouterLogs(
    selectedRouter || undefined,
    count
  )

  const logs = data?.logs ?? []
  const filteredLogs = topicFilter
    ? logs.filter((l) => l.topics.includes(topicFilter))
    : logs

  return (
    <div className="space-y-6">
      {/* Actions + Filters */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg text-xs text-slate-400 hover:text-[#4cd7f6] hover:border-[#4cd7f6]/30 transition-all"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg text-xs text-slate-400 hover:text-[#4cd7f6] hover:border-[#4cd7f6]/30 transition-all">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {data?.router ? `${data.router}` : "All routers"} · {data?.total ?? 0} entries
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Select value={selectedRouter || "default"} onValueChange={(val) => setSelectedRouter(val === "default" ? "" : val)}>
          <SelectTrigger className="w-[180px] bg-[#131b2e] border-white/5 text-xs rounded-lg">
            <SelectValue placeholder="All Routers" />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10">
            <SelectItem value="default">Default Router</SelectItem>
            {routers?.map((r) => (
              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={topicFilter || "all"} onValueChange={(val) => setTopicFilter(val === "all" ? "" : val)}>
          <SelectTrigger className="w-[160px] bg-[#131b2e] border-white/5 text-xs rounded-lg">
            <SelectValue placeholder="All Topics" />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10">
            <SelectItem value="all">All Topics</SelectItem>
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
          <SelectTrigger className="w-[120px] bg-[#131b2e] border-white/5 text-xs rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10">
            <SelectItem value="50">Last 50</SelectItem>
            <SelectItem value="100">Last 100</SelectItem>
            <SelectItem value="200">Last 200</SelectItem>
            <SelectItem value="500">Last 500</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-[10px] text-slate-500 ml-auto">
          Showing {filteredLogs.length} of {logs.length} entries · Auto-refresh 10s
        </span>
      </div>

      {/* Log Table */}
      <div className="bg-[#131b2e] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 w-32">Time</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 w-40">Topics</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3"><div className="h-3 w-16 animate-pulse rounded bg-[#222a3d]" /></td>
                    <td className="px-6 py-3"><div className="h-3 w-20 animate-pulse rounded bg-[#222a3d]" /></td>
                    <td className="px-6 py-3"><div className="h-3 w-64 animate-pulse rounded bg-[#222a3d]" /></td>
                  </tr>
                ))
              ) : !filteredLogs.length ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <Info className="mx-auto h-8 w-8 text-slate-600 mb-3" />
                    <p className="text-sm text-slate-400">No logs available</p>
                    <p className="text-[10px] text-slate-600">Add a router to see real-time logs</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, i) => {
                  const style = getTopicStyle(log.topics)
                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3">
                        <span className="text-xs font-mono text-slate-500">{log.time}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold", style.color, style.bg)}>
                          {style.icon}
                          {log.topics}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-[#dae2fd]">{log.message}</span>
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
