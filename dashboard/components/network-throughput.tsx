"use client"

import { ArrowDown, ArrowUp, Activity, Wifi } from "lucide-react"
import { useRouterTraffic } from "@/hooks/use-router-data"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function NetworkThroughput() {
  const { data, isLoading } = useRouterTraffic()

  const totalTx = data?.interfaces?.reduce((sum, i) => sum + i.txBytes, 0) ?? 0
  const totalRx = data?.interfaces?.reduce((sum, i) => sum + i.rxBytes, 0) ?? 0
  const activeInterfaces = data?.interfaces?.filter((i) => i.running).length ?? 0

  return (
    <div
      className="rounded-xl p-6 card-glass"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-headline text-lg font-bold text-foreground">
            Network Throughput
          </h3>
          <p className="text-xs text-muted-foreground/70">
            {data?.router ? `Router: ${data.router}` : "Aggregate data flow across interfaces"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider">
            {activeInterfaces} active
          </span>
          <Activity className="h-4 w-4 text-primary" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded-lg w-1/3" />
          <div className="h-4 bg-muted rounded-lg w-1/2" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      ) : !data?.interfaces?.length ? (
        <div className="h-32 flex flex-col items-center justify-center gap-2">
          <Wifi className="h-8 w-8 text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground/70">No traffic data available</p>
          <p className="text-[10px] text-muted-foreground/70">Add a router to see live traffic</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUp className="h-3.5 w-3.5 text-[#4ae176]" />
                <span className="text-[10px] text-muted-foreground/70 uppercase font-bold">Upload</span>
              </div>
              <span className="text-lg font-bold text-foreground font-mono">{formatBytes(totalTx)}</span>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground/70 uppercase font-bold">Download</span>
              </div>
              <span className="text-lg font-bold text-foreground font-mono">{formatBytes(totalRx)}</span>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] text-muted-foreground/70 uppercase font-bold">Total</span>
              </div>
              <span className="text-lg font-bold text-foreground font-mono">{formatBytes(totalTx + totalRx)}</span>
            </div>
          </div>

          {/* Per-interface breakdown */}
          <div className="space-y-2">
            <h4 className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider mb-3">
              Interface Breakdown
            </h4>
            {data.interfaces.slice(0, 6).map((iface) => {
              const total = iface.txBytes + iface.rxBytes
              const txPct = total > 0 ? (iface.txBytes / total) * 100 : 50
              return (
                <div
                  key={iface.name}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xs font-mono text-primary w-28 truncate">{iface.name}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#4ae176] rounded-l-full"
                      style={{ width: `${txPct}%` }}
                    />
                    <div
                      className="h-full bg-primary rounded-r-full"
                      style={{ width: `${100 - txPct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground w-40 justify-end">
                    <span>
                      <ArrowUp className="h-2.5 w-2.5 inline text-[#4ae176]" /> {formatBytes(iface.txBytes)}
                    </span>
                    <span>
                      <ArrowDown className="h-2.5 w-2.5 inline text-primary" /> {formatBytes(iface.rxBytes)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
