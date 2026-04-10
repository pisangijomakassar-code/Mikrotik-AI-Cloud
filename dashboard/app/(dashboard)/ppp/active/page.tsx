"use client"

import { Activity, Radio, LogOut, WifiOff } from "lucide-react"
import { usePPPActive, useKickPPP } from "@/hooks/use-ppp"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { toast } from "sonner"

export default function PPPActivePage() {
  const { data: sessions, isLoading } = usePPPActive()
  const kickPPP = useKickPPP()

  function handleKick(id: string, name: string) {
    kickPPP.mutate(id, {
      onSuccess: () => toast.success(`Session "${name}" disconnected`),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Active PPP Sessions</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Activity className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Monitor and manage active PPP connections.
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
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Name</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Service</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 hidden md:table-cell">Caller ID</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Address</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Uptime</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 hidden md:table-cell">Encoding</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-3 md:px-6 md:py-5">
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
                      <p className="text-sm text-slate-400">No active PPP sessions</p>
                      <p className="text-[10px] text-slate-600">Sessions will appear here when users connect</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session: Record<string, unknown>, idx: number) => (
                  <tr key={`${session.name}-${idx}`} className="hover:bg-white/5 transition-colors group">
                    <td className="px-3 py-3 md:px-6 md:py-5">
                      <span className="text-xs md:text-sm font-bold text-[#dae2fd]">{session.name as string}</span>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-[#222a3d] text-[#4cd7f6] font-medium uppercase">
                        {(session.service as string) || "--"}
                      </span>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 font-mono-tech text-xs text-slate-400 hidden md:table-cell">
                      {(session["caller-id"] as string) || "--"}
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 font-mono-tech text-xs md:text-sm text-cyan-400">
                      {(session.address as string) || "--"}
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 text-xs md:text-sm text-slate-400 font-mono-tech">
                      {(session.uptime as string) || "--"}
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 text-xs text-slate-400 hidden md:table-cell">
                      {(session.encoding as string) || "--"}
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 text-right">
                      <ConfirmDialog
                        trigger={
                          <button className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
                            <LogOut className="h-4 w-4" />
                          </button>
                        }
                        title={`Kick "${session.name}"?`}
                        description="This will disconnect the active PPP session. The user may reconnect automatically."
                        confirmText="Kick Session"
                        variant="destructive"
                        onConfirm={() => handleKick(
                          (session[".id"] as string) || (session.name as string),
                          session.name as string
                        )}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-[10px] md:text-xs text-slate-500">
            {sessions?.length ?? 0} active session{(sessions?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
