"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  Store,
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  Ticket,
  Download,
} from "lucide-react"
import {
  useReseller,
  useVoucherBatches,
  useTransactions,
} from "@/hooks/use-resellers"
import { GenerateVoucherDialog } from "@/components/dialogs/generate-voucher-dialog"
import { SaldoDialog } from "@/components/dialogs/saldo-dialog"
import { cn } from "@/lib/utils"
import { formatRupiah, formatDate, formatDateShort } from "@/lib/formatters"
import { StatusBadge } from "@/components/badges/status-badge"
import { SourceBadge, TransactionTypeBadge } from "@/components/badges/source-badge"
import { TableSkeleton } from "@/components/table-skeleton"
import { PaginationControl } from "@/components/pagination-control"
import { toast } from "sonner"


export default function ResellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: reseller, isLoading } = useReseller(id)
  const { data: voucherBatches, isLoading: batchesLoading } = useVoucherBatches(id)

  const [activeTab, setActiveTab] = useState<"vouchers" | "transactions">("vouchers")
  const [txPage, setTxPage] = useState(1)
  const { data: transactionsData, isLoading: txLoading } = useTransactions(id, txPage, 20)

  // Saldo dialog
  const [showSaldoDialog, setShowSaldoDialog] = useState<"topup" | "topdown" | null>(null)

  // Generate vouchers dialog
  const [showVoucherDialog, setShowVoucherDialog] = useState(false)


  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (!reseller) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Reseller not found</p>
        <Link href="/resellers" className="text-primary text-sm mt-2 inline-block hover:underline">
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
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Resellers
          </Link>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">
            {reseller.name}
          </h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Store className="h-[18px] w-[18px] text-primary shrink-0" />
            Reseller detail and management
          </p>
        </div>
        <button
          onClick={() => setShowVoucherDialog(true)}
          className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
        >
          <Ticket className="h-4 w-4" />
          Generate Voucher
        </button>
      </div>

      {/* Info & Saldo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Info Card */}
        <div className="bg-[rgba(15,23,42,0.6)] backdrop-blur-xl border border-border/20 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Reseller Info</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Name</span>
              <span className="text-sm font-bold text-foreground">{reseller.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Phone</span>
              <span className="text-sm text-foreground">{reseller.phone || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Telegram ID</span>
              <span className="text-sm font-mono-tech text-cyan-400">{reseller.telegramId || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Status</span>
              <StatusBadge status={reseller.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Created</span>
              <span className="text-sm text-foreground">{formatDateShort(reseller.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Saldo Card */}
        <div className="bg-[rgba(15,23,42,0.6)] backdrop-blur-xl border border-border/20 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Saldo</h3>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-primary font-mono-tech">
              {formatRupiah(reseller.balance ?? 0)}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setShowSaldoDialog("topup")}
              className="flex-1 flex items-center justify-center gap-2 bg-[#4ae176]/10 hover:bg-[#4ae176]/20 text-tertiary rounded-lg py-2.5 font-bold text-sm transition-colors"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Top Up
            </button>
            <button
              onClick={() => setShowSaldoDialog("topdown")}
              className="flex-1 flex items-center justify-center gap-2 bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 text-destructive rounded-lg py-2.5 font-bold text-sm transition-colors"
            >
              <ArrowDownCircle className="h-4 w-4" />
              Top Down
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border/20">
        <button
          onClick={() => setActiveTab("vouchers")}
          className={cn(
            "px-5 py-3 text-sm font-bold transition-colors",
            activeTab === "vouchers"
              ? "text-primary border-b-2 border-[#4cd7f6]"
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
              ? "text-primary border-b-2 border-[#4cd7f6]"
              : "text-slate-500 hover:text-slate-300"
          )}
        >
          Transaction History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "vouchers" && (
        <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-lowest/80">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Profile</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Count</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Total Cost</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Source</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {batchesLoading ? (
                  <TableSkeleton rows={3} columns={6} />
                ) : !voucherBatches?.length ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-slate-400">
                      No voucher batches found
                    </td>
                  </tr>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  voucherBatches.map((batch: any) => (
                    <tr key={batch.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-5 text-sm text-slate-400">{formatDate(batch.createdAt)}</td>
                      <td className="px-6 py-5 text-sm font-bold text-foreground">{batch.profile}</td>
                      <td className="px-6 py-5 text-sm text-foreground">{batch.count}</td>
                      <td className="px-6 py-5 text-sm font-bold text-primary">{formatRupiah(batch.totalCost ?? 0)}</td>
                      <td className="px-6 py-5"><SourceBadge source={batch.source} /></td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => toast.info("PDF download coming soon")}
                          className="w-8 h-8 rounded-lg hover:bg-muted text-slate-500 hover:text-primary transition-colors flex items-center justify-center ml-auto"
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
        <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-lowest/80">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Balance Before</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Balance After</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {txLoading ? (
                  <TableSkeleton rows={3} columns={6} />
                ) : !transactionsData?.data?.length ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-slate-400">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  transactionsData.data.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-5 text-sm text-slate-400">{formatDate(tx.createdAt)}</td>
                      <td className="px-6 py-5"><TransactionTypeBadge type={tx.type} /></td>
                      <td className={cn(
                        "px-6 py-5 text-sm font-bold",
                        tx.type === "TOP_UP" ? "text-tertiary" : tx.type === "TOP_DOWN" ? "text-destructive" : "text-primary"
                      )}>
                        {tx.type === "TOP_UP" ? "+" : "-"}{formatRupiah(tx.amount ?? 0)}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-400">{formatRupiah(tx.balanceBefore ?? 0)}</td>
                      <td className="px-6 py-5 text-sm text-foreground">{formatRupiah(tx.balanceAfter ?? 0)}</td>
                      <td className="px-6 py-5 text-sm text-slate-400">{tx.description || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {transactionsData && (
            <PaginationControl
              page={txPage}
              totalPages={transactionsData.totalPages}
              total={transactionsData.total}
              onPageChange={setTxPage}
            />
          )}
        </div>
      )}

      {/* Saldo Dialog */}
      {showSaldoDialog && (
        <SaldoDialog
          type={showSaldoDialog}
          resellerId={id}
          resellerName={reseller.name}
          currentBalance={reseller.balance ?? 0}
          open={!!showSaldoDialog}
          onOpenChange={(open) => !open && setShowSaldoDialog(null)}
        />
      )}

      {/* Generate Voucher Dialog */}
      <GenerateVoucherDialog
        resellerId={id}
        resellerName={reseller.name}
        currentBalance={reseller.balance ?? 0}
        routerName={reseller.router?.name}
        open={showVoucherDialog}
        onOpenChange={setShowVoucherDialog}
      />
    </div>
  )
}
