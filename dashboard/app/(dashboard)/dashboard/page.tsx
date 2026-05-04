"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useActiveRouter } from "@/components/active-router-context"
import { VoucherActivityFeed } from "@/components/voucher-activity-feed"
import { apiClient } from "@/lib/api-client"
import { formatRupiah } from "@/lib/formatters"
import {
  TrendingUp, TrendingDown, Wifi, Activity, Signal, Zap, Printer, Store, BarChart3, Ticket,
  Network, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface DashboardSummary {
  kpi: {
    revenueToday: number
    vouchersToday: number
    revenueDelta: number | null
    vouchersDelta: number | null
    bandwidthTodayGB: number
    peakHour: { hour: number; gb: number } | null
  }
  monthly: { month: string; vouchers: number; revenue: number }[]
  bandwidthMonthly: { month: string; gb: number }[]
  bandwidthHourly: { hour: number; gb: number }[]
  summary: { monthRevenue: number; monthVouchers: number }
  topProfile: { profile: string; count: number; revenue: number }[]
  topReseller: { resellerId: string; name: string; count: number; revenue: number }[]
}

interface QuickStats {
  router: string
  cpu: number
  memory: { percent: number }
  uptime: string
  hotspot?: { activeSessions: number; totalUsers: number }
}

interface InterfaceSpeedData {
  interfaces: string[]
  interfaceName: string
  currentTxMbps: number
  currentRxMbps: number
  points: { t: number; txMbps: number; rxMbps: number }[]
}

export default function DashboardPage() {
  const { activeRouter } = useActiveRouter()

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", activeRouter ?? ""],
    queryFn: () => {
      const qs = activeRouter ? `?router=${encodeURIComponent(activeRouter)}` : ""
      return apiClient.get<DashboardSummary>(`/api/dashboard/summary${qs}`)
    },
    refetchInterval: 60_000,
  })

  const quickStatsQuery = useQuery({
    queryKey: ["dashboard-quickstats", activeRouter ?? ""],
    queryFn: () => {
      const qs = activeRouter ? `?router=${encodeURIComponent(activeRouter)}` : ""
      return apiClient.get<QuickStats>(`/api/routers/quickstats${qs}`)
    },
    refetchInterval: 30_000,
    retry: false,
  })

  const data = summaryQuery.data
  const stats = quickStatsQuery.data
  const isOnline = !quickStatsQuery.isError && stats != null

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<BarChart3 className="h-4 w-4 text-tertiary" />}
          label="Pendapatan Hari Ini"
          value={data ? formatRupiah(data.kpi.revenueToday) : "—"}
          delta={data?.kpi.revenueDelta}
          loading={summaryQuery.isLoading}
        />
        <InterfaceSpeedCard routerName={activeRouter} />
        <KpiCard
          icon={<Signal className="h-4 w-4 text-blue-400" />}
          label="Active Session"
          value={stats?.hotspot ? String(stats.hotspot.activeSessions) : "—"}
          subtitle="user lagi konek"
          loading={quickStatsQuery.isLoading}
        />
        <RouterStatusCard isOnline={isOnline} stats={stats} loading={quickStatsQuery.isLoading} />
        <KpiCard
          icon={<Network className="h-4 w-4 text-purple-400" />}
          label="Traffic Hari Ini"
          value={data ? `${data.kpi.bandwidthTodayGB.toFixed(2)} GB` : "—"}
          subtitle={data?.kpi.peakHour ? `peak ${String(data.kpi.peakHour.hour).padStart(2, "0")}:00` : "—"}
          loading={summaryQuery.isLoading}
        />
      </div>

      {/* Trend chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChartCard
          title="Penjualan Bulanan"
          subtitle="Rp · 12 bulan terakhir"
          data={data?.monthly.map((m) => ({ label: formatMonth(m.month), value: m.revenue, sub: formatRupiah(m.revenue) })) ?? []}
          color="#fb923c"
          loading={summaryQuery.isLoading}
          empty="Belum ada data penjualan"
        />
        <DualLineChartCard
          data={data?.monthly.map((m) => ({ label: formatMonth(m.month), vouchers: m.vouchers, revenue: m.revenue })) ?? []}
          loading={summaryQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChartCard
          title="Usage Bandwidth Bulanan"
          subtitle="GB · download + upload"
          data={data?.bandwidthMonthly.map((m) => ({ label: formatMonth(m.month), value: m.gb, sub: `${m.gb.toFixed(2)} GB` })) ?? []}
          color="#a78bfa"
          loading={summaryQuery.isLoading}
          empty="Snapshot bandwidth belum cukup. Tunggu beberapa hari setelah router pertama kali konek."
        />
        <BarChartCard
          title="Peak Hour Hari Ini"
          subtitle="GB per jam · 24 jam"
          data={fillHourly(data?.bandwidthHourly ?? []).map((h) => ({
            label: String(h.hour).padStart(2, "0"),
            value: h.gb,
            sub: h.gb > 0 ? `${h.gb.toFixed(2)} GB` : "",
          }))}
          color="#f97316"
          loading={summaryQuery.isLoading}
          empty="Belum ada traffic snapshot hari ini"
        />
      </div>

      {/* Top profile + reseller + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">🏆 Top Profile (bulan ini)</h3>
          {data && data.topProfile.length > 0 ? (
            <div className="space-y-3">
              {data.topProfile.map((p, i) => {
                const max = data.topProfile[0]?.count ?? 1
                const w = Math.max(8, Math.round((p.count / max) * 100))
                return (
                  <div key={p.profile}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{i + 1}. {p.profile || "(default)"}</span>
                      <span className="text-muted-foreground">{p.count} · {formatRupiah(p.revenue)}</span>
                    </div>
                    <div className="h-2 rounded bg-orange-400/20" style={{ width: `${w}%` }}>
                      <div className="h-full rounded bg-gradient-to-r from-orange-500 to-orange-400" />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">Belum ada penjualan bulan ini</p>
          )}
        </div>

        <div className="card-glass rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">🏪 Top Reseller (bulan ini)</h3>
          {data && data.topReseller.length > 0 ? (
            <div className="space-y-3">
              {data.topReseller.map((r, i) => (
                <div key={r.resellerId} className="flex justify-between items-center text-sm">
                  <div>
                    <div className="text-foreground">{["🥇", "🥈", "🥉", "4.", "5."][i] ?? "·"} {r.name}</div>
                    <div className="text-[11px] text-muted-foreground/70">{r.count} voucher</div>
                  </div>
                  <span className="text-tertiary font-semibold">{formatRupiah(r.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">Belum ada reseller aktif</p>
          )}
        </div>

        <div>
          <VoucherActivityFeed height="h-[420px]" fetchCount={50} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="card-glass rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-3">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/vouchers" icon={<Zap className="h-4 w-4 text-orange-400" />} title="Generate Voucher" subtitle="Bikin batch voucher baru" />
          <QuickAction href="/resellers" icon={<TrendingUp className="h-4 w-4 text-blue-400" />} title="Top Up Reseller" subtitle="Isi saldo reseller" />
          <QuickAction href="/vouchers" icon={<Printer className="h-4 w-4 text-purple-400" />} title="Print Voucher" subtitle="Cetak batch terakhir" />
          <QuickAction href="/reports" icon={<BarChart3 className="h-4 w-4 text-tertiary" />} title="Lihat Laporan" subtitle="Detail penjualan" />
        </div>
      </div>
    </div>
  )
}

// ── components ──

function KpiCard({ icon, label, value, delta, subtitle, loading }: {
  icon: React.ReactNode
  label: string
  value: string
  delta?: number | null
  subtitle?: string
  loading?: boolean
}) {
  return (
    <div className="card-glass rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        {icon}
      </div>
      {loading ? (
        <div className="h-7 w-20 bg-muted rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-headline font-bold text-foreground">{value}</p>
      )}
      {delta != null && !loading && (
        <div className={cn("text-[11px] mt-1 flex items-center gap-1",
          delta > 0 ? "text-tertiary" : delta < 0 ? "text-destructive" : "text-muted-foreground"
        )}>
          {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
          {delta === 0 ? "sama dengan" : `${Math.abs(delta)}% vs`} kemarin
        </div>
      )}
      {subtitle && !delta && <div className="text-[11px] text-muted-foreground/70 mt-1">{subtitle}</div>}
    </div>
  )
}

function RouterStatusCard({ isOnline, stats, loading }: {
  isOnline: boolean
  stats?: QuickStats
  loading: boolean
}) {
  return (
    <div className="card-glass rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Router Status</span>
        <Activity className={cn("h-4 w-4", isOnline ? "text-tertiary" : "text-destructive")} />
      </div>
      {loading ? (
        <div className="h-7 w-20 bg-muted rounded animate-pulse" />
      ) : isOnline ? (
        <>
          <p className="text-lg font-bold text-tertiary">● ONLINE</p>
          <div className="text-[11px] text-muted-foreground/70 mt-1">
            up {stats?.uptime ?? "—"} · CPU {stats?.cpu ?? 0}% · RAM {stats?.memory.percent ?? 0}%
          </div>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-destructive">● OFFLINE</p>
          <div className="text-[11px] text-muted-foreground/70 mt-1">tidak bisa terhubung</div>
        </>
      )}
    </div>
  )
}

function BarChartCard({ title, subtitle, data, color, loading, empty }: {
  title: string
  subtitle: string
  data: { label: string; value: number; sub?: string }[]
  color: string
  loading?: boolean
  empty: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="card-glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground/70">{subtitle}</p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-end gap-1 h-40">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="flex-1 bg-muted rounded-t animate-pulse" style={{ height: `${20 + Math.random() * 60}%` }} />)}
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">{empty}</p>
      ) : (
        // Vertical column chart: bars naik dari bawah, label di bawah.
        // Pakai PIXEL height (bukan %) — items-end + flex-1 + percent height tidak compute reliably.
        <div>
          <div className="flex items-end gap-1 h-40 mb-1">
            {data.map((d, i) => {
              const h = Math.max(2, Math.round((d.value / max) * 158))  // px out of 160 (h-40)
              return (
                <div
                  key={`${d.label}-${i}`}
                  className="flex-1 group relative cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    height: `${h}px`,
                    background: `linear-gradient(180deg, ${color}, ${color}aa)`,
                    borderRadius: "4px 4px 0 0",
                  }}
                  title={d.sub}
                >
                  {d.sub && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-card border border-border rounded text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                      {d.sub}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-1">
            {data.map((d, i) => (
              <div key={`lbl-${i}`} className="flex-1 text-center text-[10px] text-muted-foreground font-mono truncate">
                {d.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuickAction({ href, icon, title, subtitle }: {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="card-glass rounded-xl p-3 hover:bg-white/5 transition-colors block"
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-[11px] text-muted-foreground/70">{subtitle}</p>
    </Link>
  )
}

function InterfaceSpeedCard({ routerName }: { routerName: string | null }) {
  const [selectedIface, setSelectedIface] = useState("")

  const query = useQuery({
    queryKey: ["interface-speed", routerName ?? "", selectedIface],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (routerName) qs.set("router", routerName)
      if (selectedIface) qs.set("iface", selectedIface)
      return apiClient.get<InterfaceSpeedData>(`/api/dashboard/interface-speed?${qs}`)
    },
    enabled: !!routerName,
    refetchInterval: 30_000,
  })

  const d = query.data
  const pts = d?.points ?? []
  const ifaces = d?.interfaces ?? []
  const effectiveIface = selectedIface || d?.interfaceName || ""

  // SVG line chart — normalize Rx and Tx together to same scale
  const W = 240, H = 52
  const maxVal = Math.max(...pts.flatMap((p) => [p.txMbps, p.rxMbps]), 0.1)
  const toX = (i: number) => (pts.length < 2 ? W / 2 : (i / (pts.length - 1)) * W).toFixed(1)
  const toY = (v: number) => (H - (v / maxVal) * (H - 2) - 1).toFixed(1)
  const rxPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.rxMbps)}`).join(" ")
  const txPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.txMbps)}`).join(" ")

  return (
    <div className="card-glass rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Internet Speed</span>
        <Activity className="h-4 w-4 text-blue-400" />
      </div>

      {/* Interface selector */}
      {!routerName ? (
        <p className="text-xs text-muted-foreground/60 py-2">Pilih router dulu</p>
      ) : ifaces.length > 0 ? (
        <select
          value={effectiveIface}
          onChange={(e) => setSelectedIface(e.target.value)}
          className="text-[10px] bg-muted/40 border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground w-full font-mono mb-2 focus:outline-none"
        >
          {ifaces.map((iface) => (
            <option key={iface} value={iface}>{iface}</option>
          ))}
        </select>
      ) : (
        <div className="text-[10px] text-muted-foreground/60 font-mono mb-2">
          {query.isLoading ? "Memuat..." : "Belum ada snapshot"}
        </div>
      )}

      {/* Current speed */}
      {query.isLoading ? (
        <div className="h-4 w-28 bg-muted rounded animate-pulse mb-2" />
      ) : (
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs">
            <span className="text-red-400 font-bold">↓</span>{" "}
            <span className="font-bold text-foreground">{(d?.currentRxMbps ?? 0).toFixed(1)}</span>
            <span className="text-muted-foreground/60 text-[10px]"> Mbps</span>
          </span>
          <span className="text-xs">
            <span className="text-blue-400 font-bold">↑</span>{" "}
            <span className="font-bold text-foreground">{(d?.currentTxMbps ?? 0).toFixed(1)}</span>
            <span className="text-muted-foreground/60 text-[10px]"> Mbps</span>
          </span>
        </div>
      )}

      {/* SVG line chart */}
      {pts.length > 1 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 52 }} preserveAspectRatio="none">
          <path d={rxPath} fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round" />
          <path d={txPath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}

      {/* Legend */}
      {pts.length > 1 && (
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 rounded bg-red-400" />
            <span className="text-[10px] text-muted-foreground">Download</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 rounded bg-blue-400" />
            <span className="text-[10px] text-muted-foreground">Upload</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DualLineChartCard({ data, loading }: {
  data: { label: string; vouchers: number; revenue: number }[]
  loading?: boolean
}) {
  const W = 240, H = 80
  const n = data.length
  const maxV = Math.max(...data.map((d) => d.vouchers), 1)
  const maxR = Math.max(...data.map((d) => d.revenue), 1)
  const toX = (i: number) => (n < 2 ? W / 2 : (i / (n - 1)) * W).toFixed(1)
  const vPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${(H - (d.vouchers / maxV) * (H - 2) - 1).toFixed(1)}`).join(" ")
  const rPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${(H - (d.revenue / maxR) * (H - 2) - 1).toFixed(1)}`).join(" ")

  return (
    <div className="card-glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Voucher & Pendapatan Bulanan</h3>
          <p className="text-[11px] text-muted-foreground/70">12 bulan terakhir · skala independen</p>
        </div>
      </div>

      {loading ? (
        <div className="h-24 bg-muted rounded animate-pulse" />
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Belum ada data penjualan</p>
      ) : (
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
            {/* Revenue line */}
            <path d={rPath} fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinejoin="round" />
            {/* Voucher count line */}
            <path d={vPath} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" />
            {/* Dots for each data point */}
            {data.map((d, i) => (
              <g key={i}>
                <circle
                  cx={toX(i)} cy={(H - (d.revenue / maxR) * (H - 2) - 1).toFixed(1)}
                  r="2.5" fill="#fb923c"
                >
                  <title>{`${d.label}: ${formatRupiah(d.revenue)}`}</title>
                </circle>
                <circle
                  cx={toX(i)} cy={(H - (d.vouchers / maxV) * (H - 2) - 1).toFixed(1)}
                  r="2.5" fill="#34d399"
                >
                  <title>{`${d.label}: ${d.vouchers} voucher`}</title>
                </circle>
              </g>
            ))}
          </svg>
          <div className="flex gap-1 mt-1">
            {data.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground font-mono truncate">
                {d.label}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded bg-tertiary" />
              <span className="text-[10px] text-muted-foreground">Voucher</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded bg-orange-400" />
              <span className="text-[10px] text-muted-foreground">Pendapatan</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-")
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

function fillHourly(rows: { hour: number; gb: number }[]): { hour: number; gb: number }[] {
  const map = new Map(rows.map((r) => [r.hour, r.gb]))
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, gb: map.get(h) ?? 0 }))
}
