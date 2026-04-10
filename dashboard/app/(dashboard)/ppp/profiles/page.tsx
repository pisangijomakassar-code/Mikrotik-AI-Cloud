"use client"

import { Settings2, FileSliders } from "lucide-react"
import { usePPPProfiles } from "@/hooks/use-ppp"

export default function PPPProfilesPage() {
  const { data: profiles, isLoading } = usePPPProfiles()

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">PPP Profiles</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Settings2 className="h-[18px] w-[18px] text-[#4cd7f6]" />
            PPP profile configurations for connection policies.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Local Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Remote Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Rate Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
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
                  <tr key={profile.name as string} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-[#dae2fd]">{profile.name as string}</span>
                    </td>
                    <td className="px-6 py-5 font-mono-tech text-sm text-slate-400">
                      {(profile["local-address"] as string) || "--"}
                    </td>
                    <td className="px-6 py-5 font-mono-tech text-sm text-slate-400">
                      {(profile["remote-address"] as string) || "--"}
                    </td>
                    <td className="px-6 py-5">
                      {(profile["rate-limit"] as string) ? (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-[#222a3d] text-[#4cd7f6] font-mono-tech">
                          {profile["rate-limit"] as string}
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
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-xs text-slate-500">
            {profiles?.length ?? 0} profile{(profiles?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
