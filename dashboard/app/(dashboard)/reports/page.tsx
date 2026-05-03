"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, Download, FileInput, Loader2, RefreshCw, Store, Ticket, TrendingUp, TrendingDown, Database, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatRupiah } from "@/lib/formatters"
import { toast } from "sonner"
import { useActiveRouter } from "@/components/active-router-context"

interface SyncRouterEntry {
  router: string
  lastSync: { syncedAt: string; imported: number; skipped: number } | null
  scriptCount: number | null
  scriptBytesEstimate: number | null
}

interface BatchDetailVoucher {
  username: string
  password: string
  status: "unused" | "active" | "removed" | "unknown"
  uptime: string
  comment: string
  profile: string
  disabled: boolean
}

interface BatchDetail {
  batch: {
    id: string
    createdAt: string
    routerName: string
    profile: string
    count: number
    pricePerUnit: number
    hargaEndUser: number
    markUp: number
    discount: number
    source: string
    reseller: { id: string; name: string } | null
  }
  summary: {
    total: number
    unused: number
    active: number
    removed: number
    unknown: number
  }
  vouchers: BatchDetailVoucher[]
}

function timeAgo(iso: string | undefined): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "baru saja"
  if (min < 60) return `${min} menit lalu`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  return `${d} hari lalu`
}

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

interface Batch {
  id: string
  routerName: string
  profile: string
  count: number
  pricePerUnit: number
  totalCost: number
  source: string
  createdAt: string
  resellerId: string | null
  reseller: { name: string } | null
}

interface Transaction {
  id: string
  type: "TOP_UP" | "TOP_DOWN" | "VOUCHER_PURCHASE"
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
  reseller: { name: string }
}

interface Summary {
  totalVouchers: number
  totalRevenue: number
  totalTopUp: number
  totalTopDown: number
  totalResellers: number
  // New (Phase 3): breakdown Generated vs Activated
  totalGenerated: number
  totalActivated: number
  totalUnused: number
  generatedRevenue: number
  activatedRevenue: number
  activationRate: number | null
}

interface ReportData {
  summary: Summary
  batches: Batch[]
  transactions: Transaction[]
  resellers: { id: string; name: string; balance: number; status: string }[]
}

function getDefaultDates() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

function getMonthDates(yearMonth: string) {
  const [year, month] = yearMonth.split("-")
  const from = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().slice(0, 10)
  const to = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10)
  return { from, to }
}

export default function ReportsPage() {
  const { activeRouter } = useActiveRouter()
  const defaults = getDefaultDates()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [resellerFilter, setResellerFilter] = useState("")
  const [data, setData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"vouchers" | "transactions">("vouchers")

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMonth, setImportMonth] = useState("")
  const [dbMonths, setDbMonths] = useState<{ month: string; vouchers: number; revenue: number }[]>([])
  const [loadingDbMonths, setLoadingDbMonths] = useState(false)

  // Sync status (auto-sync info per router)
  const [syncStatus, setSyncStatus] = useState<SyncRouterEntry[]>([])
  const [syncing, setSyncing] = useState(false)

  // Per-batch detail drawer
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<BatchDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Cleanup dialog state
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [cleanupRetention, setCleanupRetention] = useState(6)
  const [cleanupRouter, setCleanupRouter] = useState("")
  const [cleanupDryRun, setCleanupDryRun] = useState<{ wouldDelete: number; kept: number; cutoffMonth: string } | null>(null)
  const [cleanupBusy, setCleanupBusy] = useState(false)

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/hotspot/mikhmon-sync-status")
      const json = await res.json()
      setSyncStatus(json.routers ?? [])
    } catch {
      // ignore — fallback shows "—"
    }
  }, [])

  useEffect(() => { fetchSyncStatus() }, [fetchSyncStatus])

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const res = await fetch("/api/hotspot/mikhmon-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAfterImport: false }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Gagal sinkron")
      toast.success(`Sinkron selesai: ${json.imported ?? 0} voucher dicatat (${json.skipped ?? 0} dilewati)`)
      await Promise.all([fetchReport(), fetchSyncStatus()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal sinkron")
    } finally {
      setSyncing(false)
    }
  }

  async function handleCleanupDryRun() {
    setCleanupBusy(true)
    try {
      const res = await fetch("/api/hotspot/mikhmon-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ router: cleanupRouter, retentionMonths: cleanupRetention, dryRun: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Gagal preview cleanup")
      setCleanupDryRun({ wouldDelete: json.wouldDelete, kept: json.kept, cutoffMonth: json.cutoffMonth })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal preview")
    } finally {
      setCleanupBusy(false)
    }
  }

  async function handleCleanupExecute() {
    setCleanupBusy(true)
    try {
      // Sync first to ensure DB has the data before deleting from router.
      await fetch("/api/hotspot/mikhmon-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ router: cleanupRouter, deleteAfterImport: false }),
      })
      // Then delete old script entries.
      const res = await fetch("/api/hotspot/mikhmon-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ router: cleanupRouter, retentionMonths: cleanupRetention, dryRun: false }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Gagal cleanup")
      toast.success(`Cleanup selesai: ${json.deleted} script dihapus dari router`)
      setCleanupOpen(false)
      setCleanupDryRun(null)
      await fetchSyncStatus()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal cleanup")
    } finally {
      setCleanupBusy(false)
    }
  }

  function openCleanupDialog(router: string) {
    setCleanupRouter(router)
    setCleanupDryRun(null)
    setCleanupOpen(true)
  }

  // Fetch detail when batchId selected (drill-down).
  useEffect(() => {
    if (!detailBatchId) { setDetailData(null); return }
    let cancelled = false
    setDetailLoading(true)
    setDetailData(null)
    fetch(`/api/vouchers/${detailBatchId}/detail`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setDetailData(j) })
      .catch(() => { if (!cancelled) toast.error("Gagal memuat detail batch") })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [detailBatchId])

  const handleMonthChange = (yearMonth: string) => {
    setSelectedMonth(yearMonth)
    const { from: f, to: t } = getMonthDates(yearMonth)
    setFrom(f)
    setTo(t)
  }

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams({ from, to })
      if (resellerFilter) qs.set("resellerId", resellerFilter)
      if (activeRouter) qs.set("router", activeRouter)
      const res = await fetch(`/api/reports?${qs}`)
      if (!res.ok) throw new Error("Gagal memuat laporan")
      setData(await res.json())
    } catch {
      toast.error("Gagal memuat laporan")
    } finally {
      setIsLoading(false)
    }
  }, [from, to, resellerFilter, activeRouter])

  useEffect(() => { fetchReport() }, [fetchReport])

  // Reset reseller filter saat router berubah — reseller di router lain tidak valid
  useEffect(() => {
    setResellerFilter("")
  }, [activeRouter])

  async function openImportDialog() {
    setImportOpen(true)
    setLoadingDbMonths(true)
    try {
      const res = await fetch("/api/reports/months")
      const json = await res.json()
      setDbMonths(json.months ?? [])
    } catch {
      setDbMonths([])
    } finally {
      setLoadingDbMonths(false)
    }
  }

  async function handleImport(deleteAfterImport: boolean) {
    if (!importMonth) { toast.error("Pilih bulan terlebih dahulu"); return }
    setImporting(true)
    try {
      const res = await fetch("/api/hotspot/mikhmon-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAfterImport, month: importMonth }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Gagal import")
      if (json.imported === 0) {
        toast.info(json.message ?? "Tidak ada script ditemukan untuk bulan ini")
      } else if (deleteAfterImport) {
        toast.success(`Import berhasil: ${json.imported} voucher dicatat, ${json.deleted} script dihapus dari router`)
      } else {
        toast.success(`Import berhasil: ${json.imported} voucher dicatat (script di router tidak dihapus)`)
      }
      setImportOpen(false)
      fetchReport()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal import")
    } finally {
      setImporting(false)
    }
  }

  function exportCSV(type: "vouchers" | "transactions") {
    if (!data) return
    let csv = ""
    if (type === "vouchers") {
      csv = "Tanggal,Router,Profil,Jumlah,Harga/Voucher,Total,Reseller,Sumber\n"
      data.batches.forEach((b) => {
        csv += `${new Date(b.createdAt).toLocaleDateString("id-ID")},${b.routerName},${b.profile},${b.count},${b.pricePerUnit},${b.totalCost},${b.reseller?.name ?? "-"},${b.source}\n`
      })
    } else {
      csv = "Tanggal,Reseller,Tipe,Jumlah,Saldo Sebelum,Saldo Sesudah,Keterangan\n"
      data.transactions.forEach((t) => {
        csv += `${new Date(t.createdAt).toLocaleDateString("id-ID")},${t.reseller.name},${t.type},${t.amount},${t.balanceBefore},${t.balanceAfter},"${t.description}"\n`
      })
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `laporan-${type}-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Laporan</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <BarChart3 className="h-[18px] w-[18px] text-primary shrink-0" />
            Rekap penjualan voucher dan transaksi saldo reseller.
          </p>
        </div>
        <button
          onClick={openImportDialog}
          className="flex items-center gap-2 bg-surface-low border border-white/10 text-slate-300 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-[#1e2a42] hover:text-amber-400 transition-all whitespace-nowrap"
        >
          <FileInput className="h-4 w-4" />
          Import Data Penjualan
        </button>
      </div>

      {/* Import dialog */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-bold text-white mb-1">Import Data Penjualan</h3>
            <p className="text-xs text-slate-500 mb-5">Script voucher Mikhmon dari router akan dicatat ke database dan muncul di laporan bulanan.</p>

            {/* Months already in DB */}
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Sudah di database</p>
              {loadingDbMonths ? (
                <p className="text-xs text-slate-500">Memuat...</p>
              ) : dbMonths.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Belum ada data Mikhmon di database</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dbMonths.map((m) => (
                    <div key={m.month} className="flex flex-col items-center bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-center">
                      <span className="text-xs font-bold text-slate-300">{m.month}</span>
                      <span className="text-[10px] text-slate-500">{m.vouchers} vcr · {formatRupiah(m.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Month picker */}
            <div className="mb-6">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Pilih bulan untuk diimport</label>
              <input
                type="month"
                value={importMonth}
                onChange={(e) => setImportMonth(e.target.value)}
                className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] px-3 py-2 w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                disabled={importing || !importMonth}
                onClick={() => handleImport(false)}
                className="w-full px-4 py-2.5 rounded-lg font-bold text-sm bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                {importing ? "Mengimpor..." : "Import Saja"}
                <span className="block text-xs font-normal text-slate-400 mt-0.5">Script di router tidak dihapus</span>
              </button>
              <button
                disabled={importing || !importMonth}
                onClick={() => handleImport(true)}
                className="w-full px-4 py-2.5 rounded-lg font-bold text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                {importing ? "Mengimpor..." : "Import & Hapus dari Router"}
                <span className="block text-xs font-normal text-slate-400 mt-0.5">Script dihapus agar router bersih</span>
              </button>
              <button
                disabled={importing}
                onClick={() => setImportOpen(false)}
                className="w-full px-4 py-2.5 rounded-lg font-bold text-sm text-slate-500 hover:text-slate-300 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Status — per router auto-sync info + storage usage */}
      {syncStatus.length > 0 && (
        <div className="bg-surface-low rounded-2xl border border-border/20 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Status Sinkronisasi RouterOS
            </h3>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sinkron Sekarang
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {syncStatus.map((r) => (
              <div key={r.router} className="bg-muted/30 border border-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-foreground font-mono-tech">{r.router}</span>
                  <button
                    onClick={() => openCleanupDialog(r.router)}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Bersihkan log lama
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Sinkron terakhir</div>
                    <div className="text-foreground font-mono-tech">
                      {timeAgo(r.lastSync?.syncedAt)}
                      {r.lastSync && (
                        <span className="text-muted-foreground/60 ml-1.5">
                          (+{r.lastSync.imported}, ~{r.lastSync.skipped})
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">/system script (mikhmon)</div>
                    <div className="text-foreground font-mono-tech">
                      {r.scriptCount ?? "—"} entries · {formatBytes(r.scriptBytesEstimate)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2">
            Auto-sync: <strong>setiap 1 jam</strong>. Data laporan dibaca dari PostgreSQL, sinkron jaga konsistensi dengan RouterOS.
          </p>
        </div>
      )}

      {/* Cleanup dialog */}
      {cleanupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0f1623] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-bold text-white mb-1">Bersihkan Log Mikhmon</h3>
            <p className="text-xs text-slate-500 mb-5">
              Router: <span className="font-mono-tech text-foreground">{cleanupRouter}</span>.
              Script log akan disinkron ke PostgreSQL dulu, lalu dihapus dari RouterOS.
            </p>

            <div className="mb-5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">
                Hapus log lebih lama dari (bulan)
              </label>
              <Input
                type="number"
                min={1}
                max={120}
                value={cleanupRetention}
                onChange={(e) => { setCleanupRetention(Math.max(1, Math.min(120, Number(e.target.value) || 6))); setCleanupDryRun(null) }}
                className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-primary px-3 py-2 w-full font-mono-tech"
              />
              <div className="flex gap-1 mt-2">
                {[3, 6, 12, 24].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setCleanupRetention(n); setCleanupDryRun(null) }}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                      cleanupRetention === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {n} bln
                  </button>
                ))}
              </div>
            </div>

            {cleanupDryRun && (
              <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
                <div className="font-bold text-amber-400 mb-1">Preview cleanup</div>
                <div className="text-foreground">
                  Akan dihapus: <strong>{cleanupDryRun.wouldDelete}</strong> script entries
                </div>
                <div className="text-muted-foreground">
                  Tetap disimpan: {cleanupDryRun.kept} entries (cutoff: {cleanupDryRun.cutoffMonth})
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                disabled={cleanupBusy}
                onClick={handleCleanupDryRun}
                className="w-full px-4 py-2.5 rounded-lg font-bold text-sm bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                {cleanupBusy ? "Memproses..." : "Preview Dulu (Dry-run)"}
              </button>
              {cleanupDryRun && cleanupDryRun.wouldDelete > 0 && (
                <button
                  disabled={cleanupBusy}
                  onClick={handleCleanupExecute}
                  className="w-full px-4 py-2.5 rounded-lg font-bold text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                >
                  {cleanupBusy ? "Menghapus..." : `Sinkron + Hapus ${cleanupDryRun.wouldDelete} Script`}
                </button>
              )}
              <button
                disabled={cleanupBusy}
                onClick={() => { setCleanupOpen(false); setCleanupDryRun(null) }}
                className="w-full px-4 py-2.5 rounded-lg font-bold text-sm text-slate-500 hover:text-slate-300 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div className="bg-surface-low rounded-2xl border border-border/20 p-5 mb-8">
        {/* Month selector row */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Pilih Bulan</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] px-3 py-2"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={isLoading}
            className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-bold text-sm px-5 py-2.5 rounded-lg hover:brightness-105 transition-all disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Tampilkan
          </button>
        </div>

        {/* Custom date range (collapsible) */}
        <details className="mt-3 pt-3 border-t border-border/20">
          <summary className={`${labelClass} cursor-pointer`}>Tanggal Custom (opsional)</summary>
          <div className="flex flex-wrap items-end gap-4 mt-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Dari Tanggal</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setSelectedMonth("")
                }}
                className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6]"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Sampai Tanggal</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setSelectedMonth("")
                }}
                className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6]"
              />
            </div>
          </div>
        </details>

        {/* Reseller filter */}
        {data?.resellers && data.resellers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/20 flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Filter Reseller</label>
              <Select value={resellerFilter || "__all__"} onValueChange={(v) => setResellerFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="bg-muted border-none text-foreground text-sm min-w-[160px]">
                  <SelectValue placeholder="Semua Reseller" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value="__all__">Semua Reseller</SelectItem>
                  {data.resellers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Voucher Lifecycle — Generated vs Activated */}
      {data && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-2 px-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Voucher Lifecycle</h3>
            {data.summary.activationRate !== null && (
              <span className="text-[10px] text-muted-foreground/60">
                Activation rate: <strong className="text-primary">{data.summary.activationRate}%</strong>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-low rounded-2xl border border-border/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Generated</span>
              </div>
              <p className="text-2xl font-headline font-bold text-foreground">{data.summary.totalGenerated.toLocaleString("id-ID")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{formatRupiah(data.summary.generatedRevenue)} potensi</p>
            </div>
            <div className="bg-surface-low rounded-2xl border border-border/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-tertiary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Activated (Realized)</span>
              </div>
              <p className="text-2xl font-headline font-bold text-foreground">{data.summary.totalActivated.toLocaleString("id-ID")}</p>
              <p className="text-xs text-tertiary/80 mt-1">{formatRupiah(data.summary.activatedRevenue)} pendapatan</p>
            </div>
            <div className="bg-surface-low rounded-2xl border border-border/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Belum Aktif (Stock)</span>
              </div>
              <p className="text-2xl font-headline font-bold text-foreground">{data.summary.totalUnused.toLocaleString("id-ID")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Voucher belum login pertama</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { icon: Ticket, label: "Voucher Terjual", value: data.summary.totalVouchers.toLocaleString("id-ID"), color: "var(--primary)" },
            { icon: BarChart3, label: "Pendapatan", value: formatRupiah(data.summary.totalRevenue), color: "var(--tertiary)" },
            { icon: TrendingUp, label: "Total Top Up", value: formatRupiah(data.summary.totalTopUp), color: "var(--tertiary)" },
            { icon: TrendingDown, label: "Total Top Down", value: formatRupiah(data.summary.totalTopDown), color: "var(--destructive)" },
            { icon: Store, label: "Reseller", value: String(data.summary.totalResellers), color: "var(--primary)" },
          ].map((card) => (
            <div key={card.label} className="bg-surface-low rounded-2xl border border-border/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <card.icon className="h-4 w-4" style={{ color: card.color }} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{card.label}</span>
              </div>
              <p className="text-xl font-headline font-bold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-low rounded-xl p-1 w-fit border border-border/20">
        {(["vouchers", "transactions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab
                ? "bg-[#4cd7f6]/10 text-primary"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "vouchers" ? "Voucher Terjual" : "Transaksi Saldo"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : data ? (
        <div className="bg-surface-low rounded-2xl border border-border/20 overflow-hidden">
          {/* Table header with export */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
            <span className="text-sm text-slate-400">
              {activeTab === "vouchers" ? `${data.batches.length} batch` : `${data.transactions.length} transaksi`}
            </span>
            <button
              onClick={() => exportCSV(activeTab)}
              className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-bold transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            {activeTab === "vouchers" ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-lowest/80">
                    {["Tanggal", "Router", "Profil", "Jumlah", "Harga/Voucher", "Total", "Reseller", "Sumber"].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {data.batches.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">Tidak ada data</td></tr>
                  ) : data.batches.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setDetailBatchId(b.id)}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{new Date(b.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-5 py-3.5 text-xs text-foreground">{b.routerName}</td>
                      <td className="px-5 py-3.5"><span className="text-xs px-2 py-0.5 rounded bg-muted text-primary">{b.profile}</span></td>
                      <td className="px-5 py-3.5 text-xs font-bold text-foreground">{b.count}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{formatRupiah(b.pricePerUnit)}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-tertiary">{formatRupiah(b.totalCost)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{b.reseller?.name ?? "-"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{b.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-lowest/80">
                    {["Tanggal", "Reseller", "Tipe", "Jumlah", "Saldo Sebelum", "Saldo Sesudah", "Keterangan"].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {data.transactions.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">Tidak ada data</td></tr>
                  ) : data.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-5 py-3.5 text-xs text-foreground">{t.reseller.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          t.type === "TOP_UP" ? "bg-[#4ae176]/10 text-tertiary"
                          : t.type === "TOP_DOWN" ? "bg-[#ffb4ab]/10 text-destructive"
                          : "bg-[#4cd7f6]/10 text-primary"
                        }`}>{t.type}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-bold text-foreground">{formatRupiah(t.amount)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{formatRupiah(t.balanceBefore)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{formatRupiah(t.balanceAfter)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 max-w-[200px] truncate">{t.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {/* Per-batch detail drawer */}
      {detailBatchId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDetailBatchId(null)}
        >
          <div
            className="bg-[#0f1623] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Detail Batch</h3>
                {detailData && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-mono-tech">{detailData.batch.id.slice(0, 8)}…</span>
                    {" · "}
                    {new Date(detailData.batch.createdAt).toLocaleString("id-ID")}
                    {" · "}
                    Profile <span className="text-primary font-mono-tech">{detailData.batch.profile}</span>
                    {detailData.batch.reseller && <> · Reseller <span className="text-foreground">{detailData.batch.reseller.name}</span></>}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetailBatchId(null)}
                className="text-slate-500 hover:text-slate-200 transition-colors px-2 py-1"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs text-slate-500">Memuat detail voucher...</p>
              </div>
            ) : detailData ? (
              <>
                {/* Summary chips */}
                <div className="px-5 py-3 border-b border-white/5 flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded bg-muted text-foreground font-bold">
                    Total: {detailData.summary.total}
                  </span>
                  <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400">
                    Belum aktif: {detailData.summary.unused}
                  </span>
                  <span className="px-2 py-1 rounded bg-tertiary/10 text-tertiary">
                    Aktif: {detailData.summary.active}
                  </span>
                  <span className="px-2 py-1 rounded bg-destructive/10 text-destructive">
                    Hilang/expired: {detailData.summary.removed}
                  </span>
                  {detailData.summary.unknown > 0 && (
                    <span className="px-2 py-1 rounded bg-slate-500/10 text-slate-400">
                      Tidak diketahui: {detailData.summary.unknown}
                    </span>
                  )}
                </div>

                {/* Voucher table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-lowest/80 sticky top-0">
                      <tr>
                        {["Username", "Status", "Uptime", "Comment / Expiry"].map((h) => (
                          <th key={h} className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/10">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {detailData.vouchers.map((v) => (
                        <tr key={v.username} className="hover:bg-muted/30">
                          <td className="px-4 py-2 font-mono-tech font-bold text-foreground">{v.username}</td>
                          <td className="px-4 py-2">
                            <StatusPill status={v.status} />
                          </td>
                          <td className="px-4 py-2 font-mono-tech text-slate-400">{v.uptime || "—"}</td>
                          <td className="px-4 py-2 font-mono-tech text-[10px] text-slate-500 max-w-[250px] truncate" title={v.comment}>
                            {v.comment || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-sm text-slate-500">Gagal memuat data</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: BatchDetailVoucher["status"] }) {
  const styles: Record<BatchDetailVoucher["status"], string> = {
    unused:  "bg-amber-500/10 text-amber-400",
    active:  "bg-tertiary/10 text-tertiary",
    removed: "bg-destructive/10 text-destructive",
    unknown: "bg-slate-500/10 text-slate-400",
  }
  const labels: Record<BatchDetailVoucher["status"], string> = {
    unused:  "Belum aktif",
    active:  "Aktif",
    removed: "Hilang/Expired",
    unknown: "?",
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
