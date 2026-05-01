"use client"

import { useQuery } from "@tanstack/react-query"
import { useActiveRouter } from "@/components/active-router-context"
import { VoucherActivityFeed } from "@/components/voucher-activity-feed"
import { apiClient } from "@/lib/api-client"
import { formatRupiah } from "@/lib/formatters"
import {
  TrendingUp, TrendingDown, Wifi, Activity, Signal, Zap, Printer, Store, BarChart3, Ticket,
  Network, ArrowUpRight, ArrowDownRight, Clock,
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
    peakHour: { hour: number; mb: number } | null
  }
  monthly: { month: string; vouchers: number; revenue: number }[]
  bandwidthMonthly: { month: string; gb: number }[]
  bandwidthHourly: { hour: number; mb: number }[]
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
        <KpiCard
          icon={<Ticket className="h-4 w-4 text-primary" />}
          label="Voucher Terjual Hari Ini"
          value={data ? data.kpi.vouchersToday.toLocaleString("id-ID") : "—"}
          delta={data?.kpi.vouchersDelta}
          loading={summaryQuery.isLoading}
        />
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
        <BarChartCard
          title="Voucher Terjual Bulanan"
          subtitle="jumlah · 12 bulan terakhir"
          data={data?.monthly.map((m) => ({ label: formatMonth(m.month), value: m.vouchers, sub: m.vouchers.toLocaleString("id-ID") })) ?? []}
          color="#34d399"
          loading={summaryQuery.isLoading}
          empty="Belum ada voucher terjual"
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
          subtitle="MB per jam · 24 jam"
          data={fillHourly(data?.bandwidthHourly ?? []).map((h) => ({
            label: String(h.hour).padStart(2, "0"),
            value: h.mb,
            sub: h.mb > 0 ? `${h.mb.toFixed(0)} MB` : "",
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
          <QuickAction href="/vouchers/print" icon={<Printer className="h-4 w-4 text-purple-400" />} title="Print Voucher" subtitle="Cetak batch terakhir" />
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
        <div>
          <div className="flex items-end gap-1 h-40 mb-1">
            {data.map((d, i) => {
              const h = Math.max(2, Math.round((d.value / max) * 100))
              return (
                <div key={`${d.label}-${i}`} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className="w-full rounded-t transition-all hover:opacity-80"
                    style={{ height: `${h}%`, background: `linear-gradient(180deg, ${color}, ${color}aa)` }}
                  />
                  {d.sub && (
                    <div className="absolute -top-6 px-1.5 py-0.5 bg-card border border-border rounded text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
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

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-")
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

function fillHourly(rows: { hour: number; mb: number }[]): { hour: number; mb: number }[] {
  const map = new Map(rows.map((r) => [r.hour, r.mb]))
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, mb: map.get(h) ?? 0 }))
}
