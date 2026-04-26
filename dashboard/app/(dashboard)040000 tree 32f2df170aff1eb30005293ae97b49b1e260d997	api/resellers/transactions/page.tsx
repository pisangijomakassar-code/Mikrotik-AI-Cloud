"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { History, Search, ArrowLeft, ImageIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/table-skeleton"
import { formatRupiah } from "@/lib/formatters"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface TxData {
  id: string
  type: "TOP_UP" | "TOP_DOWN" | "VOUCHER_PURCHASE"
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  hargaVoucher: number
  voucherUsername: string
  voucherPassword: string
  voucherInfo: string
  proofImageUrl: string
  createdAt: string
  reseller: { id: string; name: string; telegramId: string }
}

interface HistoryResponse {
  data: TxData[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [viewProof, setViewProof] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["reseller-history", search, page],
    queryFn: () =>
      apiClient.get<HistoryResponse>(
        `/api/resellers/history?search=${encodeURIComponent(search)}&page=${page}&pageSize=30`
      ),
  })

  const typeBadge = (type: TxData["type"]) => {
    if (type === "TOP_UP") return <span className="text-[10px] px-2 py-0.5 rounded bg-[#4ae176]/10 text-tertiary font-bold">TOP UP</span>
    if (type === "TOP_DOWN") return <span className="text-[10px] px-2 py-0.5 rounded bg-[#ffb4ab]/10 text-destructive font-bold">TOP DOWN</span>
    return <span className="text-[10px] px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-primary font-bold">VOUCHER</span>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/resellers" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight">History Transaksi</h2>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 ml-8">
            <History className="h-[18px] w-[18px] text-primary shrink-0" />
            Total history: {data?.total ?? 0}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Cari nama reseller, voucher, keterangan..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-9 bg-muted border-none text-xs text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-lowest/80">
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 w-8">No</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">ID User</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Nama Reseller</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Harga Voucher</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Saldo Awal</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Saldo Akhir</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Top Up</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Username / Password Voucher</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Voucher Info</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell">Keterangan</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell">Waktu / Tanggal</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                <TableSkeleton rows={8} columns={12} />
              ) : !data?.data?.length ? (
                <tr>
                  <td colSpan={12} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <History className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">Belum ada data transaksi</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.data.map((tx, i) => {
                  const offset = (page - 1) * 30
                  return (
                    <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-1.5 text-xs text-slate-500">{offset + i + 1}</td>
                      <td className="px-3 py-1.5 font-mono-tech text-xs text-primary">
                        {tx.reseller?.telegramId || "-"}
                      </td>
                      <td className="px-3 py-1.5 text-sm font-bold text-foreground">
                        {tx.reseller?.name || "-"}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono-tech text-slate-300">
                        {tx.hargaVoucher ? formatRupiah(tx.hargaVoucher) : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono-tech text-slate-400">
                        {formatRupiah(tx.balanceBefore)}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono-tech text-slate-400">
                        {formatRupiah(tx.balanceAfter)}
                      </td>
                      <td className="px-3 py-1.5">
                        {typeBadge(tx.type)}
                        <div className="text-xs font-mono-tech text-primary mt-0.5">
                          {formatRupiah(tx.amount)}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 hidden md:table-cell">
                        {tx.voucherUsername ? (
                          <div className="font-mono-tech text-[10px] text-slate-300">
                            <div>{tx.voucherUsername}</div>
                            <div className="text-slate-500">{tx.voucherPassword}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-400 hidden md:table-cell">
                        {tx.voucherInfo || "-"}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-500 max-w-[120px] truncate hidden lg:table-cell">
                        {tx.description || "-"}
                      </td>
                      <td className="px-3 py-1.5 text-[10px] text-slate-500 hidden lg:table-cell">
                        {new Date(tx.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-3 py-1.5">
                        {tx.proofImageUrl ? (
                          <button onClick={() => setViewProof(tx.proofImageUrl)} title="Lihat bukti">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tx.proofImageUrl} alt="bukti" className="w-8 h-8 object-cover rounded border border-white/10 hover:opacity-80 transition-opacity" />
                          </button>
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-700" />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination + footer */}
        <div className="px-6 py-3 bg-surface-lowest/80 border-t border-border/20 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {data?.total ?? 0} transaksi total
          </span>
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={cn("px-3 py-1 rounded text-xs font-bold transition-colors", page === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-muted text-slate-400")}
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-500">{page} / {data?.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(data?.totalPages ?? 1, p + 1))}
                disabled={page === (data?.totalPages ?? 1)}
                className={cn("px-3 py-1 rounded text-xs font-bold transition-colors", page === data?.totalPages ? "opacity-30 cursor-not-allowed" : "hover:bg-muted text-slate-400")}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
      {viewProof && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setViewProof(null)}>
          <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewProof} alt="Bukti Transfer" className="w-full rounded-xl shadow-2xl" />
            <button onClick={() => setViewProof(null)} className="absolute top-3 right-3 p-2 bg-black/60 rounded-full hover:bg-black/80 transition-colors">
              <ArrowLeft className="h-5 w-5 text-white rotate-[135deg]" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
