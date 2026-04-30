"use client"

import { Ticket, RefreshCw } from "lucide-react"
import { useRouterLogs } from "@/hooks/use-router-data"
import { useActiveRouter } from "@/components/active-router-context"
import { cn } from "@/lib/utils"
import {
  parseHotspotMessage,
  formatHotspotMessage,
  getTopicStyle,
} from "@/lib/parse-hotspot-log"

// Feed log voucher real-time untuk dashboard utama. Filter ke event hotspot
// (login/logout/gagal) saja — tidak ada noise system/dhcp/wireless.
export function VoucherActivityFeed() {
  const { activeRouter } = useActiveRouter()
  const { data, isLoading, isFetching, refetch } = useRouterLogs(
    activeRouter || undefined,
    200,
  )

  const allLogs = data?.logs ?? []
  const voucherLogs = allLogs
    .map((l) => ({ ...l, parsed: parseHotspotMessage(l.message) }))
    .filter((l) => l.parsed.kind !== null)
    .reverse()  // terbaru di atas

  return (
    <div className="card-glass rounded-xl p-6 min-h-[calc(100vh-8rem)] flex flex-col shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h3 className="font-headline font-bold text-lg text-foreground">
            Log Aktivitas Voucher
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {data?.router && (
            <span className="text-xs text-muted-foreground/70">{data.router}</span>
          )}
          <span className="px-2 py-0.5 bg-[#4ae176]/10 text-[10px] rounded-lg border border-[#4ae176]/20 text-tertiary font-bold">
            LIVE
          </span>
          <button
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2 animate-pulse">
                <div className="mt-1 w-2 h-2 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-2.5 w-1/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : voucherLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Ticket className="h-6 w-6 text-muted-foreground/70" />
            </div>
            <p className="text-sm text-muted-foreground">Belum ada aktivitas voucher</p>
            <p className="text-[11px] text-muted-foreground/70">
              Login/logout voucher akan muncul di sini saat user hotspot konek
            </p>
          </div>
        ) : (
          voucherLogs.map((log, i) => {
            const style = getTopicStyle(log.topics, log.parsed)
            const formatted = formatHotspotMessage(log.parsed, log.message)
            return (
              <div
                key={`vlog-${i}-${log.time}`}
                className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div
                  className={cn(
                    "mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                    style.bg,
                    style.color,
                  )}
                >
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm leading-relaxed", style.color)}>
                    {formatted}
                  </p>
                  <span className="text-[11px] font-mono text-muted-foreground/70">
                    {log.time}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
