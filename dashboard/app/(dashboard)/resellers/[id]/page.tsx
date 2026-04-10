"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  Store,
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  X,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react"
import {
  useReseller,
  useTopUpSaldo,
  useTopDownSaldo,
  useVoucherBatches,
  useTransactions,
  useGenerateVouchers,
} from "@/hooks/use-resellers"
import { useHotspotProfiles } from "@/hooks/use-hotspot"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
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

function transactionTypeBadge(type: string) {
  switch (type) {
    case "TOP_UP":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4ae176]/15 text-[#4ae176]">Top Up</span>
    case "TOP_DOWN":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ffb4ab]/15 text-[#ffb4ab]">Top Down</span>
    case "VOUCHER_PURCHASE":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4cd7f6]/15 text-[#4cd7f6]">Voucher Purchase</span>
    default:
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-700/50 text-slate-400">{type}</span>
  }
}

export default function ResellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: reseller, isLoading } = useReseller(id)
  const { data: voucherBatches, isLoading: batchesLoading } = useVoucherBatches(id)
  const topUpSaldo = useTopUpSaldo()
  const topDownSaldo = useTopDownSaldo()
  const generateVouchers = useGenerateVouchers()
  const { data: profiles } = useHotspotProfiles()

  const [activeTab, setActiveTab] = useState<"vouchers" | "transactions">("vouchers")
  const [txPage, setTxPage] = useState(1)
  const { data: transactionsData, isLoading: txLoading } = useTransactions(id, txPage, 20)

  // Saldo dialog
  const [showSaldoDialog, setShowSaldoDialog] = useState<"topup" | "topdown" | null>(null)
  const [saldoAmount, setSaldoAmount] = useState("")
  const [saldoDesc, setSaldoDesc] = useState("")

  // Generate vouchers dialog
  const [showVoucherDialog, setShowVoucherDialog] = useState(false)
  const [vProfile, setVProfile] = useState("")
  const [vCount, setVCount] = useState("")
  const [vPrice, setVPrice] = useState("")
  const [vRouter, setVRouter] = useState("")

  function handleSaldoSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(saldoAmount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    const mutation = showSaldoDialog === "topup" ? topUpSaldo : topDownSaldo
    mutation.mutate(
      {
        resellerId: id,
        data: { amount, description: saldoDesc.trim() || undefined },
      },
      {
        onSuccess: () => {
          toast.success(showSaldoDialog === "topup" ? "Top up successful" : "Top down successful")
          setShowSaldoDialog(null)
          setSaldoAmount("")
          setSaldoDesc("")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleGenerateVouchers(e: React.FormEvent) {
    e.preventDefault()
    if (!vProfile) { toast.error("Select a profile"); return }
    const count = parseInt(vCount)
    const price = parseInt(vPrice)
    if (!count || count <= 0) { toast.error("Enter a valid count"); return }
    if (!price || price <= 0) { toast.error("Enter a valid price"); return }

    generateVouchers.mutate(
      {
        resellerId: id,
        data: {
          profile: vProfile,
          count,
          pricePerUnit: price,
          routerName: vRouter.trim() || "default",
        },
      },
      {
        onSuccess: () => {
          toast.success("Vouchers generated successfully")
          setShowVoucherDialog(false)
          setVProfile("")
          setVCount("")
          setVPrice("")
          setVRouter("")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const totalCost = (parseInt(vCount) || 0) * (parseInt(vPrice) || 0)
  const currentBalance = reseller?.balance ?? 0
  const remainingBalance = currentBalance - totalCost

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[#222a3d]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#222a3d]" />
      </div>
    )
  }

  if (!reseller) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Reseller not found</p>
        <Link href="/resellers" className="text-[#4cd7f6] text-sm mt-2 inline-block hover:underline">
          Back to Reseller List
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <Link
            href="/resellers"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#4cd7f6] transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Resellers
          </Link>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">
            {reseller.name}
          </h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Store className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Reseller detail and management
          </p>
        </div>
        <button
          onClick={() => setShowVoucherDialog(true)}
          className="flex items-center gap-2 bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
        >
          <Ticket className="h-4 w-4" />
          Generate Voucher
        </button>
      </div>

      {/* Info & Saldo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Info Card */}
        <div className="bg-[rgba(15,23,42,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Reseller Info</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Name</span>
              <span className="text-sm font-bold text-[#dae2fd]">{reseller.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Phone</span>
              <span className="text-sm text-[#dae2fd]">{reseller.phone || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Telegram ID</span>
              <span className="text-sm font-mono-tech text-cyan-400">{reseller.telegramId || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Status</span>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  reseller.status === "ACTIVE"
                    ? "bg-[#4ae176]/15 text-[#4ae176]"
                    : "bg-slate-700/50 text-slate-400"
                )}
              >
                {reseller.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Created</span>
              <span className="text-sm text-[#dae2fd]">{formatDateShort(reseller.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Saldo Card */}
        <div className="bg-[rgba(15,23,42,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Saldo</h3>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-[#4cd7f6] font-mono-tech">
              {formatRupiah(reseller.balance ?? 0)}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                setShowSaldoDialog("topup")
                setSaldoAmount("")
                setSaldoDesc("")
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#4ae176]/10 hover:bg-[#4ae176]/20 text-[#4ae176] rounded-lg py-2.5 font-bold text-sm transition-colors"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Top Up
            </button>
            <button
              onClick={() => {
                setShowSaldoDialog("topdown")
                setSaldoAmount("")
                setSaldoDesc("")
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 text-[#ffb4ab] rounded-lg py-2.5 font-bold text-sm transition-colors"
            >
              <ArrowDownCircle className="h-4 w-4" />
              Top Down
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/5">
        <button
          onClick={() => setActiveTab("vouchers")}
          className={cn(
            "px-5 py-3 text-sm font-bold transition-colors",
            activeTab === "vouchers"
              ? "text-[#4cd7f6] border-b-2 border-[#4cd7f6]"
              : "text-slate-500 hover:text-slate-300"
          )}
        >
          Voucher History
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={cn(
            "px-5 py-3 text-sm font-bold transition-colors",
            activeTab === "transactions"
              ? "text-[#4cd7f6] border-b-2 border-[#4cd7f6]"
              : "text-slate-500 hover:text-slate-300"
          )}
        >
          Transaction History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "vouchers" && (
        <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Profile</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Count</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Total Cost</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Source</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {batchesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-5">
                          <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !voucherBatches?.length ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-slate-400">
                      No voucher batches found
                    </td>
                  </tr>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  voucherBatches.map((batch: any) => (
                    <tr key={batch.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-5 text-sm text-slate-400">{formatDate(batch.createdAt)}</td>
                      <td className="px-6 py-5 text-sm font-bold text-[#dae2fd]">{batch.profile}</td>
                      <td className="px-6 py-5 text-sm text-[#dae2fd]">{batch.count}</td>
                      <td className="px-6 py-5 text-sm font-bold text-[#4cd7f6]">{formatRupiah(batch.totalCost ?? 0)}</td>
                      <td className="px-6 py-5">{sourceBadge(batch.source)}</td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => toast.info("PDF download coming soon")}
                          className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#4cd7f6] transition-colors flex items-center justify-center ml-auto"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Balance Before</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Balance After</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {txLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-5">
                          <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !transactionsData?.data?.length ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-slate-400">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  transactionsData.data.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-5 text-sm text-slate-400">{formatDate(tx.createdAt)}</td>
                      <td className="px-6 py-5">{transactionTypeBadge(tx.type)}</td>
                      <td className={cn(
                        "px-6 py-5 text-sm font-bold",
                        tx.type === "TOP_UP" ? "text-[#4ae176]" : tx.type === "TOP_DOWN" ? "text-[#ffb4ab]" : "text-[#4cd7f6]"
                      )}>
                        {tx.type === "TOP_UP" ? "+" : "-"}{formatRupiah(tx.amount ?? 0)}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-400">{formatRupiah(tx.balanceBefore ?? 0)}</td>
                      <td className="px-6 py-5 text-sm text-[#dae2fd]">{formatRupiah(tx.balanceAfter ?? 0)}</td>
                      <td className="px-6 py-5 text-sm text-slate-400">{tx.description || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {transactionsData && transactionsData.totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
              <span className="text-xs text-slate-500">
                Page {transactionsData.page} of {transactionsData.totalPages} ({transactionsData.total} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="p-1 hover:bg-[#2d3449] rounded-lg disabled:opacity-30"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 text-slate-400" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(transactionsData.totalPages, 5) }).map((_, i) => {
                    const page = i + 1
                    return (
                      <button
                        key={page}
                        onClick={() => setTxPage(page)}
                        className={cn(
                          "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg",
                          txPage === page
                            ? "bg-[#4cd7f6] text-[#003640]"
                            : "text-slate-400 hover:bg-[#2d3449]"
                        )}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>
                <button
                  className="p-1 hover:bg-[#2d3449] rounded-lg disabled:opacity-30"
                  disabled={txPage >= (transactionsData.totalPages ?? 1)}
                  onClick={() => setTxPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saldo Dialog */}
      {showSaldoDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-md mx-4 md:mx-0 bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">
                  {showSaldoDialog === "topup" ? "Top Up Saldo" : "Top Down Saldo"}
                </h3>
                <p className="text-sm text-slate-500">
                  {reseller.name} — Current: {formatRupiah(reseller.balance ?? 0)}
                </p>
              </div>
              <button
                onClick={() => setShowSaldoDialog(null)}
                className="text-slate-500 hover:text-[#dae2fd] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSaldoSubmit}>
              <div className="p-4 md:p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Amount (Rp) *</label>
                  <Input
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                    placeholder="100000"
                    type="number"
                    min="1"
                    value={saldoAmount}
                    onChange={(e) => setSaldoAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Description (optional)</label>
                  <Input
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                    placeholder="e.g. Transfer BCA"
                    value={saldoDesc}
                    onChange={(e) => setSaldoDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-4 md:p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowSaldoDialog(null)}
                  className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topUpSaldo.isPending || topDownSaldo.isPending}
                  className={cn(
                    "font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70",
                    showSaldoDialog === "topup"
                      ? "bg-gradient-to-br from-[#4ae176] to-[#22c55e] text-[#003640]"
                      : "bg-gradient-to-br from-[#ffb4ab] to-[#ef4444] text-[#003640]"
                  )}
                >
                  {(topUpSaldo.isPending || topDownSaldo.isPending)
                    ? "Processing..."
                    : showSaldoDialog === "topup"
                      ? "Top Up"
                      : "Top Down"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Voucher Dialog */}
      {showVoucherDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-xl mx-4 md:mx-0 bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Generate Vouchers</h3>
                <p className="text-sm text-slate-500">Create hotspot vouchers for {reseller.name}</p>
              </div>
              <button
                onClick={() => setShowVoucherDialog(false)}
                className="text-slate-500 hover:text-[#dae2fd] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleGenerateVouchers}>
              <div className="p-4 md:p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Profile *</label>
                  <Select value={vProfile || "__default__"} onValueChange={(v) => setVProfile(v === "__default__" ? "" : v)}>
                    <SelectTrigger className="w-full bg-[#2d3449] border-none text-[#dae2fd] text-sm">
                      <SelectValue placeholder="Select profile..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d3449] border-white/10 text-[#dae2fd]">
                      <SelectItem value="__default__">Select profile...</SelectItem>
                      {profiles?.map((p: { name: string }) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Router Name (optional, default: default)</label>
                  <Input
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                    placeholder="default"
                    value={vRouter}
                    onChange={(e) => setVRouter(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Count *</label>
                    <Input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="10"
                      type="number"
                      min="1"
                      value={vCount}
                      onChange={(e) => setVCount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Price per Unit (Rp) *</label>
                    <Input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="5000"
                      type="number"
                      min="1"
                      value={vPrice}
                      onChange={(e) => setVPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Cost Calculation */}
                <div className="bg-[#222a3d]/50 rounded-xl border border-white/5 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total Cost</span>
                    <span className="font-bold text-[#dae2fd]">
                      {vCount && vPrice ? `${vCount} x ${formatRupiah(parseInt(vPrice) || 0)} = ${formatRupiah(totalCost)}` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Current Saldo</span>
                    <span className="font-bold text-[#4cd7f6]">{formatRupiah(currentBalance)}</span>
                  </div>
                  <div className="border-t border-white/5 my-1" />
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Remaining After</span>
                    <span className={cn(
                      "font-bold",
                      remainingBalance >= 0 ? "text-[#4ae176]" : "text-[#ffb4ab]"
                    )}>
                      {formatRupiah(remainingBalance)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowVoucherDialog(false)}
                  className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateVouchers.isPending || remainingBalance < 0}
                  className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {generateVouchers.isPending ? "Generating..." : "Generate Vouchers"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
