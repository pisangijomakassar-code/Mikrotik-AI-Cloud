"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, Download, FileInput, Loader2, RefreshCw, Store, Ticket, TrendingUp, TrendingDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatRupiah } from "@/lib/formatters"
import { toast } from "sonner"

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
      const res = await fetch(`/api/reports?${qs}`)
      if (!res.ok) throw new Error("Gagal memuat laporan")
      setData(await res.json())
    } catch {
      toast.error("Gagal memuat laporan")
    } finally {
      setIsLoading(false)
    }
  }, [from, to, resellerFilter])

  useEffect(() => { fetchReport() }, [fetchReport])

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

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { icon: Ticket, label: "Total Voucher", value: data.summary.totalVouchers.toLocaleString("id-ID"), color: "var(--primary)" },
            { icon: BarChart3, label: "Total Penjualan", value: formatRupiah(data.summary.totalRevenue), color: "var(--tertiary)" },
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
                    <tr key={b.id} className="hover:bg-muted/50 transition-colors">
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
    </div>
  )
}
