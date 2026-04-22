"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart3, Download, Loader2, RefreshCw, Store, Ticket, TrendingUp, TrendingDown } from "lucide-react"
import { Input } from "@/components/ui/input"
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
}

function getDefaultDates() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

export default function ReportsPage() {
  const defaults = getDefaultDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [data, setData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"vouchers" | "transactions">("vouchers")

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/reports?from=${from}&to=${to}`)
      if (!res.ok) throw new Error("Gagal memuat laporan")
      setData(await res.json())
    } catch {
      toast.error("Gagal memuat laporan")
    } finally {
      setIsLoading(false)
    }
  }, [from, to])

  useEffect(() => { fetchReport() }, [fetchReport])

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
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Laporan</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <BarChart3 className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Rekap penjualan voucher dan transaksi saldo reseller.
          </p>
        </div>
      </div>

      {/* Date filter */}
      <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-5 mb-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Dari Tanggal</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-[#222a3d] border-none rounded-lg text-sm text-[#dae2fd] focus:ring-1 focus:ring-[#4cd7f6]"
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Sampai Tanggal</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-[#222a3d] border-none rounded-lg text-sm text-[#dae2fd] focus:ring-1 focus:ring-[#4cd7f6]"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={isLoading}
            className="flex items-center gap-2 bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-bold text-sm px-5 py-2.5 rounded-lg hover:brightness-105 transition-all disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Tampilkan
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { icon: Ticket, label: "Total Voucher", value: data.summary.totalVouchers.toLocaleString("id-ID"), color: "#4cd7f6" },
            { icon: BarChart3, label: "Total Penjualan", value: formatRupiah(data.summary.totalRevenue), color: "#4ae176" },
            { icon: TrendingUp, label: "Total Top Up", value: formatRupiah(data.summary.totalTopUp), color: "#4ae176" },
            { icon: TrendingDown, label: "Total Top Down", value: formatRupiah(data.summary.totalTopDown), color: "#ffb4ab" },
            { icon: Store, label: "Reseller", value: String(data.summary.totalResellers), color: "#4cd7f6" },
          ].map((card) => (
            <div key={card.label} className="bg-[#131b2e] rounded-2xl border border-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <card.icon className="h-4 w-4" style={{ color: card.color }} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{card.label}</span>
              </div>
              <p className="text-xl font-headline font-bold text-[#dae2fd]">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#131b2e] rounded-xl p-1 w-fit border border-white/5">
        {(["vouchers", "transactions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab
                ? "bg-[#4cd7f6]/10 text-[#4cd7f6]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "vouchers" ? "Voucher Terjual" : "Transaksi Saldo"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 text-[#4cd7f6] animate-spin" />
        </div>
      ) : data ? (
        <div className="bg-[#131b2e] rounded-2xl border border-white/5 overflow-hidden">
          {/* Table header with export */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <span className="text-sm text-slate-400">
              {activeTab === "vouchers" ? `${data.batches.length} batch` : `${data.transactions.length} transaksi`}
            </span>
            <button
              onClick={() => exportCSV(activeTab)}
              className="flex items-center gap-2 text-xs text-[#4cd7f6] hover:text-[#4cd7f6]/80 font-bold transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            {activeTab === "vouchers" ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50">
                    {["Tanggal", "Router", "Profil", "Jumlah", "Harga/Voucher", "Total", "Reseller", "Sumber"].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.batches.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">Tidak ada data</td></tr>
                  ) : data.batches.map((b) => (
                    <tr key={b.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{new Date(b.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-5 py-3.5 text-xs text-[#dae2fd]">{b.routerName}</td>
                      <td className="px-5 py-3.5"><span className="text-xs px-2 py-0.5 rounded bg-[#222a3d] text-[#4cd7f6]">{b.profile}</span></td>
                      <td className="px-5 py-3.5 text-xs font-bold text-[#dae2fd]">{b.count}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{formatRupiah(b.pricePerUnit)}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-[#4ae176]">{formatRupiah(b.totalCost)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{b.reseller?.name ?? "-"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{b.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50">
                    {["Tanggal", "Reseller", "Tipe", "Jumlah", "Saldo Sebelum", "Saldo Sesudah", "Keterangan"].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.transactions.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">Tidak ada data</td></tr>
                  ) : data.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-5 py-3.5 text-xs text-[#dae2fd]">{t.reseller.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          t.type === "TOP_UP" ? "bg-[#4ae176]/10 text-[#4ae176]"
                          : t.type === "TOP_DOWN" ? "bg-[#ffb4ab]/10 text-[#ffb4ab]"
                          : "bg-[#4cd7f6]/10 text-[#4cd7f6]"
                        }`}>{t.type}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-bold text-[#dae2fd]">{formatRupiah(t.amount)}</td>
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
