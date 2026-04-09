"use client"

import { Clock } from "lucide-react"
import { useLogs } from "@/hooks/use-logs"
import { cn } from "@/lib/utils"

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins} minutes ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hours ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "Yesterday"
  return `${diffDays} days ago`
}

function getStatusColor(status: string, action: string): string {
  if (status === "error") return "bg-[#ffb4ab]"
  if (action === "admin") return "bg-[#4ae176]"
  if (action === "write") return "bg-[#4cd7f6]"
  return "bg-[#4cd7f6]"
}

export function ActivityFeed() {
  const { data, isLoading } = useLogs({ pageSize: 10, page: 1 })

  return (
    <div
      className="rounded-xl p-6 h-[560px] flex flex-col shadow-2xl relative"
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
        <span className="px-2 py-0.5 bg-[#2d3449] text-[10px] rounded-lg border border-white/5 text-[#dae2fd]">
          LIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-3 animate-pulse">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-[#222a3d] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[#222a3d]" />
                  <div className="h-3 w-1/2 rounded bg-[#222a3d]" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 rounded-full bg-[#222a3d] flex items-center justify-center">
              <Clock className="h-5 w-5 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">No activity yet</p>
            <p className="text-[10px] text-slate-600">
              Activity will appear here as users interact with routers
            </p>
          </div>
        ) : (
          data.data.map((log) => (
            <div
              key={log.id}
              className="flex gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <div
                className={cn(
                  "mt-1.5 w-2 h-2 rounded-full shrink-0",
                  getStatusColor(log.status, log.action)
                )}
              />
              <div>
                <p className="text-sm text-[#dae2fd]">
                  <span className="font-bold text-white">
                    {log.user?.name || "System"}
                  </span>
                  {log.tool && (
                    <>
                      {" "}executed{" "}
                      <span className="font-mono-tech text-xs px-1.5 py-0.5 bg-slate-900 rounded-lg text-cyan-300">
                        {log.tool}
                      </span>
                    </>
                  )}
                  {log.router?.name && (
                    <>
                      {" "}on{" "}
                      <span className="text-slate-400">{log.router.name}</span>
                    </>
                  )}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {formatTimeAgo(log.createdAt)}
                  {log.action &&
                    ` \u2022 ${log.action.charAt(0).toUpperCase() + log.action.slice(1)}`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
