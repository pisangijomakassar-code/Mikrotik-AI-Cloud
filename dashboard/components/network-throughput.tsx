"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Activity, Wifi } from "lucide-react"
import { useRouterTraffic, useRouterTrafficMonthly } from "@/hooks/use-router-data"
import { useActiveRouter } from "@/components/active-router-context"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

type TabKey = "reboot" | "month" | "30d"

export function NetworkThroughput() {
  const [tab, setTab] = useState<TabKey>("reboot")
  const { activeRouter } = useActiveRouter()

  // Live counter sejak reboot router (raw /interface).
  const live = useRouterTraffic()

  // Hitung rentang 30 hari terakhir untuk tab "30 Hari".
  const range30d = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return { start: start.toISOString(), end: end.toISOString() }
  }, [])

  const monthly = useRouterTrafficMonthly({
    router: activeRouter || undefined,
    enabled: tab === "month",
  })
  const last30 = useRouterTrafficMonthly({
    router: activeRouter || undefined,
    start: range30d.start,
    end: range30d.end,
    enabled: tab === "30d",
  })

  const view = tab === "reboot"
    ? {
        loading: live.isLoading,
        router: live.data?.router ?? "",
        interfaces: (live.data?.interfaces ?? [])
          .filter((i) => i.running)
          .map((i) => ({ name: i.name, txBytes: i.txBytes, rxBytes: i.rxBytes })),
        subtitle: "Counter sejak router terakhir reboot",
      }
    : tab === "month"
      ? {
          loading: monthly.isLoading,
          router: monthly.data?.router ?? activeRouter ?? "",
          interfaces: monthly.data?.interfaces ?? [],
          subtitle: monthlySubtitle(monthly.data?.year, monthly.data?.month),
        }
      : {
          loading: last30.isLoading,
          router: last30.data?.router ?? activeRouter ?? "",
          interfaces: last30.data?.interfaces ?? [],
          subtitle: "Akumulasi 30 hari terakhir",
        }

  const totalTx = view.interfaces.reduce((s, i) => s + i.txBytes, 0)
  const totalRx = view.interfaces.reduce((s, i) => s + i.rxBytes, 0)
  const activeCount = view.interfaces.length

  return (
    <div className="rounded-xl p-6 card-glass">
      <div className="flex justify-between items-start mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="font-headline text-lg font-bold text-foreground">
            Network Throughput
          </h3>
          <p className="text-xs text-muted-foreground/70">
            {view.router ? `Router: ${view.router} · ${view.subtitle}` : view.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider">
            {activeCount} interface
          </span>
          <Activity className="h-4 w-4 text-primary" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-4">
        <TabsList>
          <TabsTrigger value="reboot">Sejak Reboot</TabsTrigger>
          <TabsTrigger value="month">Bulan Ini</TabsTrigger>
          <TabsTrigger value="30d">30 Hari</TabsTrigger>
        </TabsList>
        <TabsContent value="reboot" />
        <TabsContent value="month" />
        <TabsContent value="30d" />
      </Tabs>

      {view.loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded-lg w-1/3" />
          <div className="h-4 bg-muted rounded-lg w-1/2" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      ) : !view.interfaces.length ? (
        <div className="h-32 flex flex-col items-center justify-center gap-2">
          <Wifi className="h-8 w-8 text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground/70">
            {tab === "reboot"
              ? "Belum ada data trafik live"
              : "Belum ada snapshot — agent kumpulkan data tiap 10 menit"}
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            {tab === "reboot"
              ? "Tambah router untuk melihat trafik"
              : "Tunggu beberapa interval lalu refresh"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUp className="h-3.5 w-3.5 text-tertiary" />
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

          <div className="space-y-2">
            <h4 className="text-[10px] text-muted-foreground/70 uppercase font-bold tracking-wider mb-3">
              Interface Breakdown
            </h4>
            {view.interfaces.slice(0, 6).map((iface) => {
              const total = iface.txBytes + iface.rxBytes
              const txPct = total > 0 ? (iface.txBytes / total) * 100 : 50
              return (
                <div
                  key={iface.name}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xs font-mono text-primary w-28 truncate">{iface.name}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                    <div className="h-full bg-[#4ae176] rounded-l-full" style={{ width: `${txPct}%` }} />
                    <div className="h-full bg-primary rounded-r-full" style={{ width: `${100 - txPct}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground w-40 justify-end">
                    <span>
                      <ArrowUp className="h-2.5 w-2.5 inline text-tertiary" /> {formatBytes(iface.txBytes)}
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

function monthlySubtitle(year?: number, month?: number): string {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = (month ?? now.getMonth() + 1) - 1
  const names = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ]
  return `Akumulasi ${names[m]} ${y}`
}
