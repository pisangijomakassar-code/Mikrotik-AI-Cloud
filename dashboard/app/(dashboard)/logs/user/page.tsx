"use client"

import { useState, useMemo } from "react"
import { UserCog, RefreshCw, Search } from "lucide-react"
import { useRouterLogs } from "@/hooks/use-router-data"
import { useActiveRouter } from "@/components/active-router-context"
import { parseUserLogs } from "@/lib/parse-mikhmon-logs"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function UserLogPage() {
  const { activeRouter } = useActiveRouter()
  const { data, isLoading, isFetching, refetch } = useRouterLogs(activeRouter || undefined, 200)
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    const parsed = parseUserLogs(data?.logs ?? [])
    if (!search) return parsed.slice().reverse()
    const s = search.toLowerCase()
    return parsed
      .filter((r) => r.user.toLowerCase().includes(s) || r.ip.includes(s) || r.action.toLowerCase().includes(s))
      .reverse()
  }, [data, search])

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCog className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold text-foreground">User Log</h1>
          </div>
          <p className="text-sm text-muted-foreground/70">
            Login / logout / aksi system user RouterOS (admin & service)
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="card-glass rounded-xl px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="card-glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search user / IP / aksi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground/70">
            {data?.router && <>{data.router} · </>}
            {rows.length} entri
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 text-left border-b border-border/30">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-32">Time</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">User (IP)</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20 animate-pulse">
                    <td className="px-5 py-3"><div className="h-3 w-20 bg-muted rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-32 bg-muted rounded" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-56 bg-muted rounded" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-12 text-center text-sm text-muted-foreground">Tidak ada user log</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.time}-${i}`} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.time}</td>
                    <td className="px-5 py-3">
                      <span className="text-foreground font-medium">{r.user || "-"}</span>
                      {r.ip && <span className="text-muted-foreground/70"> ({r.ip})</span>}
                    </td>
                    <td className={cn(
                      "px-5 py-3 text-xs",
                      r.action.toLowerCase().includes("fail") ? "text-destructive"
                      : r.action.toLowerCase().includes("logout") ? "text-muted-foreground"
                      : "text-foreground"
                    )}>
                      {r.action}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
