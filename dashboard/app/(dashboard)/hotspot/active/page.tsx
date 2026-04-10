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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Active Sessions</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Signal className="h-[18px] w-[18px] text-[#4cd7f6]" />
            Real-time hotspot session monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg">
            <Radio className="h-3 w-3 text-[#4ae176] animate-pulse" />
            <span className="text-xs font-bold text-[#4ae176]">Live</span>
            <span className="text-[10px] text-slate-500 ml-1">Auto-refresh 30s</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">User</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">IP Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">MAC Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Uptime</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Server</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Bytes In</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Bytes Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
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
                  <tr key={`${session.user}-${session["mac-address"]}-${idx}`} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-[#dae2fd]">{session.user}</span>
                    </td>
                    <td className="px-6 py-5 font-mono-tech text-sm text-cyan-400">
                      {session.address}
                    </td>
                    <td className="px-6 py-5 font-mono-tech text-xs text-slate-400">
                      {session["mac-address"]}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-400 font-mono-tech">
                      {session.uptime}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-400">
                      {session.server}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-[#222a3d] text-[#4ae176] font-mono-tech">
                        {formatBytes(session["bytes-in"])}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-[#222a3d] text-[#4cd7f6] font-mono-tech">
                        {formatBytes(session["bytes-out"])}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-xs text-slate-500">
            {sessions?.length ?? 0} active session{(sessions?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
