"use client"

import { Clock, AlertTriangle, Info, Shield, Wifi } from "lucide-react"
import { useLogs } from "@/hooks/use-logs"
import { useRouterLogs } from "@/hooks/use-router-data"
import { cn } from "@/lib/utils"

function getTopicIcon(topics: string) {
  if (topics.includes("error") || topics.includes("critical")) return <AlertTriangle className="h-3 w-3 text-[#ffb4ab]" />
  if (topics.includes("warning")) return <AlertTriangle className="h-3 w-3 text-amber-400" />
  if (topics.includes("firewall")) return <Shield className="h-3 w-3 text-[#4cd7f6]" />
  if (topics.includes("wireless") || topics.includes("dhcp")) return <Wifi className="h-3 w-3 text-[#4ae176]" />
  return <Info className="h-3 w-3 text-slate-500" />
}

function getTopicColor(topics: string) {
  if (topics.includes("error") || topics.includes("critical")) return "bg-[#ffb4ab]"
  if (topics.includes("warning")) return "bg-amber-400"
  if (topics.includes("firewall")) return "bg-[#4cd7f6]"
  if (topics.includes("wireless") || topics.includes("dhcp")) return "bg-[#4ae176]"
  return "bg-slate-500"
}

export function ActivityFeed() {
  const dbLogs = useLogs({ pageSize: 10, page: 1 })
  const routerLogs = useRouterLogs(undefined, 20)

  const hasDbLogs = (dbLogs.data?.data?.length ?? 0) > 0
  const isLoading = dbLogs.isLoading && routerLogs.isLoading

  return (
    <div
      className="rounded-xl p-6 h-[560px] flex flex-col shadow-2xl"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#4cd7f6]" />
          <h3 className="font-headline font-bold text-[#dae2fd]">Recent Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          {routerLogs.data?.router && (
            <span className="text-[10px] text-slate-500">{routerLogs.data.router}</span>
          )}
          <span className="px-2 py-0.5 bg-[#4ae176]/10 text-[10px] rounded-lg border border-[#4ae176]/20 text-[#4ae176] font-bold">
            LIVE
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2 animate-pulse">
                <div className="mt-1 w-2 h-2 rounded-full bg-[#222a3d] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-[#222a3d]" />
                  <div className="h-2.5 w-1/3 rounded bg-[#222a3d]" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasDbLogs && !routerLogs.data?.logs?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 rounded-full bg-[#222a3d] flex items-center justify-center">
              <Clock className="h-5 w-5 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">No activity yet</p>
            <p className="text-[10px] text-slate-600">Logs from your routers will appear here</p>
          </div>
        ) : (
          <>
            {/* Show router system logs (real-time from MikroTik) */}
            {routerLogs.data?.logs?.map((log, i) => (
              <div
                key={`rlog-${i}`}
                className="flex gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors cursor-default"
              >
                <div className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", getTopicColor(log.topics))} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#dae2fd] leading-relaxed truncate">
                    {log.message}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-600">{log.time}</span>
                    {log.topics && (
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        {getTopicIcon(log.topics)}
                        {log.topics}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Fallback: show DB activity logs if any */}
            {hasDbLogs && dbLogs.data?.data?.map((log) => (
              <div
                key={log.id}
                className="flex gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0",
                  log.status === "error" ? "bg-[#ffb4ab]" : "bg-[#4cd7f6]"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#dae2fd]">
                    <span className="font-bold text-white">{log.user?.name || "System"}</span>
                    {log.tool && <> — <span className="font-mono text-[#4cd7f6]">{log.tool}</span></>}
                  </p>
                  <span className="text-[10px] text-slate-600">{log.action}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
