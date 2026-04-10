"use client"

import { useState } from "react"
import {
  Store,
  PlusCircle,
  X,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  useResellers,
  useCreateReseller,
  useUpdateReseller,
  useDeleteReseller,
  useTopUpSaldo,
  useTopDownSaldo,
} from "@/hooks/use-resellers"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function ResellersPage() {
  const { data: resellers, isLoading } = useResellers()
  const createReseller = useCreateReseller()
  const updateReseller = useUpdateReseller()
  const deleteReseller = useDeleteReseller()
  const topUpSaldo = useTopUpSaldo()
  const topDownSaldo = useTopDownSaldo()

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showSaldoDialog, setShowSaldoDialog] = useState<{
    type: "topup" | "topdown"
    reseller: Record<string, unknown>
  } | null>(null)

  // Add form state
  const [addName, setAddName] = useState("")
  const [addPhone, setAddPhone] = useState("")
  const [addTelegramId, setAddTelegramId] = useState("")
  const [addBalance, setAddBalance] = useState("")

  // Edit form state
  const [editReseller, setEditReseller] = useState<Record<string, unknown> | null>(null)
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editTelegramId, setEditTelegramId] = useState("")
  const [editStatus, setEditStatus] = useState("")

  // Saldo form state
  const [saldoAmount, setSaldoAmount] = useState("")
  const [saldoDesc, setSaldoDesc] = useState("")

  function resetAddForm() {
    setAddName("")
    setAddPhone("")
    setAddTelegramId("")
    setAddBalance("")
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) {
      toast.error("Name is required")
      return
    }
    createReseller.mutate(
      {
        name: addName.trim(),
        phone: addPhone.trim() || undefined,
        telegramId: addTelegramId.trim() || undefined,
        balance: addBalance ? parseInt(addBalance) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Reseller created")
          resetAddForm()
          setShowAddDialog(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function openEditDialog(reseller: Record<string, unknown>) {
    setEditReseller(reseller)
    setEditName(reseller.name as string || "")
    setEditPhone(reseller.phone as string || "")
    setEditTelegramId(reseller.telegramId as string || "")
    setEditStatus(reseller.status as string || "ACTIVE")
    setShowEditDialog(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editReseller) return
    updateReseller.mutate(
      {
        id: editReseller.id as string,
        data: {
          name: editName.trim() || undefined,
          phone: editPhone.trim() || undefined,
          telegramId: editTelegramId.trim() || undefined,
          status: editStatus as "ACTIVE" | "INACTIVE",
        },
      },
      {
        onSuccess: () => {
          toast.success("Reseller updated")
          setShowEditDialog(false)
          setEditReseller(null)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleSaldoSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!showSaldoDialog) return
    const amount = parseInt(saldoAmount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    const resellerId = showSaldoDialog.reseller.id as string
    const mutation = showSaldoDialog.type === "topup" ? topUpSaldo : topDownSaldo
    mutation.mutate(
      {
        resellerId,
        data: {
          amount,
          description: saldoDesc.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(showSaldoDialog.type === "topup" ? "Top up successful" : "Top down successful")
          setShowSaldoDialog(null)
          setSaldoAmount("")
          setSaldoDesc("")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleDelete(id: string) {
    deleteReseller.mutate(id, {
      onSuccess: () => toast.success("Reseller deleted"),
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">
            Reseller Management
          </h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Store className="h-[18px] w-[18px] text-[#4cd7f6]" />
            Manage resellers and their saldo balances.
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
        >
          <PlusCircle className="h-4 w-4" />
          Add Reseller
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Phone</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Telegram ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Balance</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Vouchers Sold</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Actions</th>
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
              ) : !resellers?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-400">
                    No resellers found
                  </td>
                </tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                resellers.map((reseller: any) => (
                  <tr key={reseller.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <Link
                        href={`/resellers/${reseller.id}`}
                        className="text-sm font-bold text-[#dae2fd] hover:text-[#4cd7f6] transition-colors"
                      >
                        {reseller.name}
                      </Link>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-400">
                      {reseller.phone || "-"}
                    </td>
                    <td className="px-6 py-5 font-mono-tech text-cyan-400 text-sm">
                      {reseller.telegramId || "-"}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-[#4cd7f6]">
                      {formatRupiah(reseller.balance ?? 0)}
                    </td>
                    <td className="px-6 py-5">
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
                    </td>
                    <td className="px-6 py-5 text-sm text-[#dae2fd]">
                      {reseller._count?.voucherBatches ?? reseller.vouchersSold ?? 0}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#4cd7f6] transition-colors flex items-center justify-center"
                          title="Edit"
                          onClick={() => openEditDialog(reseller)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#4ae176] transition-colors flex items-center justify-center"
                          title="Top Up Saldo"
                          onClick={() => {
                            setShowSaldoDialog({ type: "topup", reseller })
                            setSaldoAmount("")
                            setSaldoDesc("")
                          }}
                        >
                          <ArrowUpCircle className="h-4 w-4" />
                        </button>
                        <button
                          className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#ffb4ab] transition-colors flex items-center justify-center"
                          title="Top Down Saldo"
                          onClick={() => {
                            setShowSaldoDialog({ type: "topdown", reseller })
                            setSaldoAmount("")
                            setSaldoDesc("")
                          }}
                        >
                          <ArrowDownCircle className="h-4 w-4" />
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          }
                          title={`Delete "${reseller.name}"?`}
                          description="This will permanently delete this reseller, all voucher batches, and transaction history. This action cannot be undone."
                          confirmText="Delete Reseller"
                          variant="destructive"
                          onConfirm={() => handleDelete(reseller.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-xs text-slate-500">
            Showing {resellers?.length ?? 0} resellers
          </span>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-[#2d3449] rounded-lg disabled:opacity-30" disabled>
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-[#4cd7f6] text-[#003640] rounded-lg">1</button>
            </div>
            <button className="p-1 hover:bg-[#2d3449] rounded-lg disabled:opacity-30" disabled>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Reseller Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Add Reseller</h3>
                <p className="text-sm text-slate-500">Create a new reseller account.</p>
              </div>
              <button
                onClick={() => { setShowAddDialog(false); resetAddForm() }}
                className="text-slate-500 hover:text-[#dae2fd] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Name *</label>
                  <Input
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                    placeholder="Reseller name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Phone</label>
                    <Input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="08xxxxxxxxxx"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Telegram ID</label>
                    <Input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="123456789"
                      value={addTelegramId}
                      onChange={(e) => setAddTelegramId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Initial Balance (Rp)</label>
                  <Input
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                    placeholder="0"
                    type="number"
                    min="0"
                    value={addBalance}
                    onChange={(e) => setAddBalance(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => { setShowAddDialog(false); resetAddForm() }}
                  className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReseller.isPending}
                  className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {createReseller.isPending ? "Creating..." : "Add Reseller"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Reseller Dialog */}
      {showEditDialog && editReseller && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Edit Reseller</h3>
                <p className="text-sm text-slate-500">Update reseller information.</p>
              </div>
              <button
                onClick={() => { setShowEditDialog(false); setEditReseller(null) }}
                className="text-slate-500 hover:text-[#dae2fd] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Name</label>
                  <Input
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Phone</label>
                    <Input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Telegram ID</label>
                    <Input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      value={editTelegramId}
                      onChange={(e) => setEditTelegramId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Status</label>
                  <Select value={editStatus || "__default__"} onValueChange={(v) => setEditStatus(v === "__default__" ? "" : v)}>
                    <SelectTrigger className="w-full bg-[#2d3449] border-none text-[#dae2fd] text-sm">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d3449] border-white/10 text-[#dae2fd]">
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => { setShowEditDialog(false); setEditReseller(null) }}
                  className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateReseller.isPending}
                  className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {updateReseller.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Saldo Top Up / Top Down Dialog */}
      {showSaldoDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">
                  {showSaldoDialog.type === "topup" ? "Top Up Saldo" : "Top Down Saldo"}
                </h3>
                <p className="text-sm text-slate-500">
                  {showSaldoDialog.reseller.name as string} — Current: {formatRupiah((showSaldoDialog.reseller.balance as number) ?? 0)}
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
              <div className="p-8 space-y-6">
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
              <div className="p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
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
                    showSaldoDialog.type === "topup"
                      ? "bg-gradient-to-br from-[#4ae176] to-[#22c55e] text-[#003640]"
                      : "bg-gradient-to-br from-[#ffb4ab] to-[#ef4444] text-[#003640]"
                  )}
                >
                  {(topUpSaldo.isPending || topDownSaldo.isPending)
                    ? "Processing..."
                    : showSaldoDialog.type === "topup"
                      ? "Top Up"
                      : "Top Down"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
