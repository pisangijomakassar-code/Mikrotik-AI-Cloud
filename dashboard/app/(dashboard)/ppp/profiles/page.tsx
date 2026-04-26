"use client"

import { Settings2, FileSliders } from "lucide-react"
import { usePPPProfiles } from "@/hooks/use-ppp"

export default function PPPProfilesPage() {
  const { data: profiles, isLoading } = usePPPProfiles()

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">PPP Profiles</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Settings2 className="h-[18px] w-[18px] text-primary shrink-0" />
            PPP profile configurations for connection policies.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-lowest/80">
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Name</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Local Address</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Remote Address</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Rate Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-2">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !profiles?.length ? (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileSliders className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">No PPP profiles found</p>
                      <p className="text-[10px] text-slate-600">Profiles are configured on the router</p>
                    </div>
                  </td>
                </tr>
              ) : (
                profiles.map((profile: Record<string, unknown>) => (
                  <tr key={profile.name as string} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2">
                      <span className="text-sm font-bold text-foreground">{profile.name as string}</span>
                    </td>
                    <td className="px-4 py-2 font-mono-tech text-sm text-slate-400">
                      {(profile.localAddress as string) || "--"}
                    </td>
                    <td className="px-4 py-2 font-mono-tech text-sm text-slate-400">
                      {(profile.remoteAddress as string) || "--"}
                    </td>
                    <td className="px-4 py-2">
                      {(profile.rateLimit as string) ? (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-primary font-mono-tech">
                          {profile.rateLimit as string}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">--</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-lowest/80 flex items-center justify-between border-t border-border/20">
          <span className="text-xs text-slate-500">
            {profiles?.length ?? 0} profile{(profiles?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
