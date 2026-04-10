"use client"

import { useState } from "react"
import { Receipt, ChevronLeft, ChevronRight } from "lucide-react"
import { useAllVouchers } from "@/hooks/use-vouchers"
import { useResellers } from "@/hooks/use-resellers"
import { cn } from "@/lib/utils"

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sourceBadge(source: string) {
  switch (source) {
    case "dashboard":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4cd7f6]/15 text-[#4cd7f6]">Dashboard</span>
    case "nanobot":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4ae176]/15 text-[#4ae176]">Nanobot</span>
    case "reseller_bot":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#a78bfa]/15 text-[#a78bfa]">Reseller Bot</span>
    default:
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-700/50 text-slate-400">{source}</span>
  }
}

export default function VoucherHistoryPage() {
  const [sourceFilter, setSourceFilter] = useState("")
  const [resellerFilter, setResellerFilter] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data: resellers } = useResellers()
  const { data: vouchersData, isLoading } = useAllVouchers({
    source: sourceFilter || undefined,
    resellerId: resellerFilter || undefined,
    page,
    pageSize,
  })

  // Support both paginated { data, total, page, totalPages } and plain array responses
  const vouchers = Array.isArray(vouchersData) ? vouchersData : vouchersData?.data
  const totalPages = Array.isArray(vouchersData) ? 1 : (vouchersData?.totalPages ?? 1)
  const total = Array.isArray(vouchersData) ? vouchersData.length : (vouchersData?.total ?? 0)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">
            Voucher History
          </h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Receipt className="h-[18px] w-[18px] text-[#4cd7f6]" />
            All vouchers from dashboard, Nanobot, and reseller bot.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          className="bg-[#131b2e] border border-white/5 rounded-lg text-sm px-4 py-2.5 text-[#dae2fd] outline-none focus:ring-1 focus:ring-[#4cd7f6]"
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Sources</option>
          <option value="dashboard">Dashboard</option>
          <option value="nanobot">Nanobot</option>
          <option value="reseller_bot">Reseller Bot</option>
        </select>
        <select
          className="bg-[#131b2e] border border-white/5 rounded-lg text-sm px-4 py-2.5 text-[#dae2fd] outline-none focus:ring-1 focus:ring-[#4cd7f6]"
          value={resellerFilter}
          onChange={(e) => { setResellerFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Resellers</option>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {resellers?.map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {(sourceFilter || resellerFilter) && (
          <button
            onClick={() => { setSourceFilter(""); setResellerFilter(""); setPage(1) }}
            className="text-xs text-slate-500 hover:text-[#4cd7f6] transition-colors px-3"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Reseller</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Router</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Profile</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Count</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Total Cost</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !vouchers?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-400">
                    No voucher batches found
                  </td>
                </tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                vouchers.map((batch: any) => (
                  <tr key={batch.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5 text-sm text-slate-400">{formatDate(batch.createdAt)}</td>
                    <td className="px-6 py-5 text-sm font-bold text-[#dae2fd]">
                      {batch.reseller?.name || batch.resellerName || "Admin"}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-400">{batch.routerName || "-"}</td>
                    <td className="px-6 py-5 text-sm text-[#dae2fd]">{batch.profile}</td>
                    <td className="px-6 py-5 text-sm text-[#dae2fd]">{batch.count}</td>
                    <td className="px-6 py-5 text-sm font-bold text-[#4cd7f6]">{formatRupiah(batch.totalCost ?? 0)}</td>
                    <td className="px-6 py-5">{sourceBadge(batch.source)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-xs text-slate-500">
            {totalPages > 1
              ? `Page ${page} of ${totalPages} (${total} total)`
              : `Showing ${vouchers?.length ?? 0} voucher batches`}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="p-1 hover:bg-[#2d3449] rounded-lg disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg",
                      page === pageNum
                        ? "bg-[#4cd7f6] text-[#003640]"
                        : "text-slate-400 hover:bg-[#2d3449]"
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              className="p-1 hover:bg-[#2d3449] rounded-lg disabled:opacity-30"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
