"use client"

import { Signal, Radio, WifiOff } from "lucide-react"
import { useHotspotActive } from "@/hooks/use-hotspot"

function formatBytes(bytes?: number): string {
  if (bytes == null || bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export default function HotspotActivePage() {
  const { data: sessions, isLoading } = useHotspotActive()

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Active Sessions</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Signal className="h-[18px] w-[18px] text-primary shrink-0" />
            Real-time hotspot session monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-low border border-border/20 rounded-lg">
            <Radio className="h-3 w-3 text-tertiary animate-pulse" />
            <span className="text-xs font-bold text-tertiary">Live</span>
            <span className="text-[10px] text-slate-500 ml-1">Auto-refresh 30s</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-lowest/80">
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">User</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">IP Address</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">MAC Address</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Uptime</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Server</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Bytes In</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Bytes Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-1.5 md:px-4 md:py-2">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !sessions?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <WifiOff className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">No active sessions</p>
                      <p className="text-[10px] text-slate-600">Sessions will appear here when users connect</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session, idx) => (
                  <tr key={`${session.user}-${session.macAddress}-${idx}`} className="hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-1.5 md:px-4 md:py-2">
                      <span className="text-xs md:text-sm font-bold text-foreground">{session.user}</span>
                    </td>
                    <td className="px-3 py-1.5 md:px-4 md:py-2 font-mono-tech text-xs md:text-sm text-cyan-400">
                      {session.address}
                    </td>
                    <td className="px-3 py-1.5 md:px-4 md:py-2 font-mono-tech text-xs text-slate-400 hidden md:table-cell">
                      {session.macAddress}
                    </td>
                    <td className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm text-slate-400 font-mono-tech">
                      {session.uptime}
                    </td>
                    <td className="px-3 py-1.5 md:px-4 md:py-2 text-sm text-slate-400 hidden md:table-cell">
                      {session.server}
                    </td>
                    <td className="px-3 py-1.5 md:px-4 md:py-2">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-tertiary font-mono-tech">
                        {formatBytes(session.bytesIn)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 md:px-4 md:py-2">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-primary font-mono-tech">
                        {formatBytes(session.bytesOut)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-lowest/80 flex items-center justify-between border-t border-border/20">
          <span className="text-[10px] md:text-xs text-slate-500">
            {sessions?.length ?? 0} active session{(sessions?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
