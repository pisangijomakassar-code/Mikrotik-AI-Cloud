"use client"

import { useState, useMemo } from "react"
import {
  Store, PlusCircle, Pencil, Trash2,
  ArrowUpCircle, ArrowDownCircle, X, Search, History, ImagePlus, Eye,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react"
import {
  useResellers, useUpdateReseller, useDeleteReseller,
  useTopUpSaldo, useTopDownSaldo,
  type ResellerData,
} from "@/hooks/use-resellers"
import { useVoucherTypes } from "@/hooks/use-voucher-types"
import { useActiveRouter } from "@/components/active-router-context"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { AddResellerDialog } from "@/components/dialogs/add-reseller-dialog"
import { TableSkeleton } from "@/components/table-skeleton"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatRupiah } from "@/lib/formatters"
import { toast } from "sonner"
import Link from "next/link"

export default function ResellersPage() {
  const { activeRouter } = useActiveRouter()
  const { data: resellers, isLoading } = useResellers(activeRouter || undefined)
  const { data: voucherTypes } = useVoucherTypes()
  const updateReseller = useUpdateReseller()
  const deleteReseller = useDeleteReseller()
  const topUpSaldo = useTopUpSaldo()
  const topDownSaldo = useTopDownSaldo()

  const [search, setSearch] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [sortCol, setSortCol] = useState<"name" | "balance" | "discount" | "updatedAt">("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  function handleSort(col: "name" | "balance" | "discount" | "updatedAt") {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortCol(col); setSortDir("asc") }
    setPage(1)
  }

  function SortIcon({ col }: { col: "name" | "balance" | "discount" | "updatedAt" }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30 inline ml-1" />
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary inline ml-1" />
      : <ChevronDown className="h-3 w-3 text-primary inline ml-1" />
  }

  // Edit dialog state
  const [editReseller, setEditReseller] = useState<ResellerData | null>(null)
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editTelegramId, setEditTelegramId] = useState("")
  const [editDiscount, setEditDiscount] = useState("0")
  const [editVoucherGroup, setEditVoucherGroup] = useState("default")
  const [editUplink, setEditUplink] = useState("")
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")

  // Saldo dialog state
  const [showSaldoDialog, setShowSaldoDialog] = useState<{
    type: "topup" | "topdown"; reseller: ResellerData
  } | null>(null)
  const [saldoAmount, setSaldoAmount] = useState("")
  const [saldoDesc, setSaldoDesc] = useState("")
  const [proofImageUrl, setProofImageUrl] = useState("")
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [showProofModal, setShowProofModal] = useState(false)

  const voucherGroups = useMemo(() => {
    const groups = new Set<string>(["default"])
    for (const vt of voucherTypes ?? []) {
      vt.voucherGroup.split(",").map((g) => g.trim()).filter(Boolean).forEach((g) => groups.add(g))
    }
    return Array.from(groups)
  }, [voucherTypes])

  // Filter + Sort + Paginate
  const filteredSorted = useMemo(() => {
    const f = (resellers ?? []).filter((r) =>
      !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.telegramId.includes(search) || r.phone.includes(search)
    )
    return [...f].sort((a, b) => {
      let av: string | number = "", bv: string | number = ""
      if (sortCol === "name") { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      else if (sortCol === "balance") { av = a.balance ?? 0; bv = b.balance ?? 0 }
      else if (sortCol === "discount") { av = a.discount ?? 0; bv = b.discount ?? 0 }
      else if (sortCol === "updatedAt") { av = a.updatedAt; bv = b.updatedAt }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [resellers, search, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const filtered = filteredSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function openEdit(r: ResellerData) {
    setEditReseller(r)
    setEditName(r.name)
    setEditPhone(r.phone)
    setEditTelegramId(r.telegramId)
    setEditDiscount(String(r.discount ?? 0))
    setEditVoucherGroup(r.voucherGroup ?? "default")
    setEditUplink(r.uplink ?? "")
    setEditStatus(r.status)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editReseller) return
    updateReseller.mutate(
      {
        id: editReseller.id,
        data: {
          name: editName.trim(),
          phone: editPhone.trim(),
          telegramId: editTelegramId.trim(),
          status: editStatus,
          discount: parseInt(editDiscount) || 0,
          voucherGroup: editVoucherGroup.trim() || "default",
          uplink: editUplink.trim(),
        },
      },
      {
        onSuccess: () => { toast.success("Reseller diperbarui"); setEditReseller(null) },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  async function handleProofFile(file: File) {
    const bitmap = await createImageBitmap(file)
    const maxW = 800
    const scale = Math.min(1, maxW / bitmap.width)
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w; canvas.height = h
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
    setProofPreview(dataUrl)
    setProofImageUrl(dataUrl)
  }

  function handleSaldoSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!showSaldoDialog) return
    const amount = parseInt(saldoAmount)
    if (!amount || amount <= 0) { toast.error("Masukkan nominal yang valid"); return }
    const mutation = showSaldoDialog.type === "topup" ? topUpSaldo : topDownSaldo
    mutation.mutate(
      { resellerId: showSaldoDialog.reseller.id, data: { amount, description: saldoDesc.trim() || undefined, proofImageUrl: proofImageUrl || undefined } },
      {
        onSuccess: () => {
          toast.success(showSaldoDialog.type === "topup" ? "Top up berhasil" : "Top down berhasil")
          setShowSaldoDialog(null); setSaldoAmount(""); setSaldoDesc(""); setProofImageUrl(""); setProofPreview(null)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleDelete(id: string) {
    deleteReseller.mutate(id, {
      onSuccess: () => toast.success("Reseller dihapus"),
      onError: (err) => toast.error(err.message),
    })
  }

  const inputCls = "w-full bg-muted border-none rounded-lg py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Reseller</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Store className="h-[18px] w-[18px] text-primary shrink-0" />
            Kelola akun reseller dan saldo mereka.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/resellers/transactions"
            className="flex items-center gap-2 bg-muted border border-border text-muted-foreground px-4 py-2.5 rounded-lg font-bold text-sm hover:text-foreground hover:border-primary transition-all"
          >
            <History className="h-4 w-4" />
            History Transaksi
          </Link>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4" />
            Add Reseller
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Cari nama, Telegram ID, HP..."
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
                <th onClick={() => handleSort("name")} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 cursor-pointer hover:text-primary transition-colors select-none">Nama Reseller<SortIcon col="name" /></th>
                <th onClick={() => handleSort("discount")} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell cursor-pointer hover:text-primary transition-colors select-none">Diskon(%)<SortIcon col="discount" /></th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell">Uplink</th>
                <th onClick={() => handleSort("balance")} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 cursor-pointer hover:text-primary transition-colors select-none">Saldo<SortIcon col="balance" /></th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Group VCR</th>
                <th onClick={() => handleSort("updatedAt")} className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell cursor-pointer hover:text-primary transition-colors select-none">Last Update<SortIcon col="updatedAt" /></th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 text-right">Operation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                <TableSkeleton rows={5} columns={9} />
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={9} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Store className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">Belum ada reseller</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-1.5 text-xs text-slate-500">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-3 py-1.5 font-mono-tech text-xs text-primary">
                      {r.telegramId || "-"}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="text-sm font-bold text-foreground">{r.name}</span>
                      {r.phone && <div className="text-[10px] text-slate-500">{r.phone}</div>}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-400 hidden md:table-cell">
                      {r.discount ?? 0}%
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-500 font-mono-tech hidden lg:table-cell">
                      {r.uplink || "-"}
                    </td>
                    <td className="px-3 py-1.5 text-sm font-bold text-primary">
                      {formatRupiah(r.balance ?? 0)}
                    </td>
                    <td className="px-3 py-1.5 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-primary">
                        {r.voucherGroup || "default"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-500 hidden lg:table-cell">
                      {new Date(r.updatedAt).toLocaleDateString("id-ID")}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Edit"
                          onClick={() => openEdit(r)}
                          className="w-7 h-7 rounded-lg hover:bg-muted text-slate-500 hover:text-primary transition-colors flex items-center justify-center"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Top Up Saldo"
                          onClick={() => { setShowSaldoDialog({ type: "topup", reseller: r }); setSaldoAmount(""); setSaldoDesc("") }}
                          className="w-7 h-7 rounded-lg hover:bg-muted text-slate-500 hover:text-tertiary transition-colors flex items-center justify-center"
                        >
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Top Down Saldo"
                          onClick={() => { setShowSaldoDialog({ type: "topdown", reseller: r }); setSaldoAmount(""); setSaldoDesc("") }}
                          className="w-7 h-7 rounded-lg hover:bg-muted text-slate-500 hover:text-destructive transition-colors flex items-center justify-center"
                        >
                          <ArrowDownCircle className="h-3.5 w-3.5" />
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button className="w-7 h-7 rounded-lg hover:bg-muted text-slate-500 hover:text-destructive transition-colors flex items-center justify-center">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          }
                          title={`Hapus "${r.name}"?`}
                          description="Semua voucher batch dan history transaksi reseller ini akan ikut terhapus. Tindakan tidak dapat dibatalkan."
                          confirmText="Hapus Reseller"
                          variant="destructive"
                          onConfirm={() => handleDelete(r.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-surface-lowest/80 border-t border-border/20 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-slate-500">
            {filteredSorted.length} reseller{search ? ` (dari ${resellers?.length ?? 0})` : ""}
            {" · "} hal {safePage}/{totalPages}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="px-3 py-1 rounded text-xs font-bold text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">← Prev</button>
              <span className="text-xs text-slate-500 px-2">{safePage} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-3 py-1 rounded text-xs font-bold text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">»</button>
            </div>
          )}
        </div>
      </div>

      <AddResellerDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

      {/* Edit Dialog */}
      {editReseller && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="w-full max-w-xl mx-4 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-headline font-bold text-foreground">Edit Reseller</h3>
                <p className="text-xs text-muted-foreground">{editReseller.name}</p>
              </div>
              <button onClick={() => setEditReseller(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="overflow-y-auto flex-1">
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Username / Nama</label>
                  <Input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>ID Telegram User</label>
                    <Input className={inputCls} value={editTelegramId} onChange={(e) => setEditTelegramId(e.target.value)} placeholder="421687437" />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>No Hp/Whatsapp</label>
                    <Input className={inputCls} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="08xx" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Diskon (%)</label>
                    <Input className={inputCls} type="number" min="0" max="100" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Grup Voucher</label>
                    <select
                      value={editVoucherGroup}
                      onChange={(e) => setEditVoucherGroup(e.target.value)}
                      className="w-full bg-muted border-none rounded-lg py-2.5 px-4 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {voucherGroups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Uplink <span className="normal-case text-muted-foreground/40">(ID Telegram upline)</span></label>
                  <Input className={inputCls} value={editUplink} onChange={(e) => setEditUplink(e.target.value)} placeholder="ID Telegram upline" />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                    className="w-full bg-muted border-none rounded-lg py-2.5 px-4 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-muted/50 flex justify-end gap-3 border-t border-border shrink-0">
                <button type="button" onClick={() => setEditReseller(null)} className="px-6 py-2 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors">Batal</button>
                <button
                  type="submit"
                  disabled={updateReseller.isPending}
                  className="bg-gradient-to-br from-primary to-primary-container text-primary-foreground font-bold px-6 py-2 rounded-lg hover:scale-105 transition-transform disabled:opacity-70 text-sm"
                >
                  {updateReseller.isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Up / Top Down Dialog */}
      {showSaldoDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-headline font-bold text-foreground">
                  {showSaldoDialog.type === "topup" ? "Top Up Saldo" : "Top Down Saldo"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {showSaldoDialog.reseller.name} — Saldo: {formatRupiah(showSaldoDialog.reseller.balance ?? 0)}
                </p>
              </div>
              <button onClick={() => { setShowSaldoDialog(null); setProofPreview(null); setProofImageUrl("") }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaldoSubmit}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Saldo (Rp) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono-tech">Rp.</span>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary text-foreground outline-none"
                      placeholder="0"
                      type="number"
                      min="1"
                      value={saldoAmount}
                      onChange={(e) => setSaldoAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Keterangan <span className="normal-case text-muted-foreground/40">(opsional)</span></label>
                  <Input
                    className={inputCls}
                    placeholder="e.g. Transfer BCA"
                    value={saldoDesc}
                    onChange={(e) => setSaldoDesc(e.target.value)}
                  />
                </div>
                {showSaldoDialog.type === "topup" && (
                  <div className="space-y-1.5">
                    <label className={labelCls}>Bukti Transfer <span className="normal-case text-muted-foreground/40">(opsional)</span></label>
                    {proofPreview ? (
                      <div className="relative group w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={proofPreview} alt="Bukti" className="w-full max-h-40 object-contain rounded-lg border border-white/10 bg-muted" />
                        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
                          <button type="button" onClick={() => setShowProofModal(true)} className="p-1.5 bg-muted/50 rounded-lg hover:bg-muted-foreground/20 transition-colors">
                            <Eye className="h-4 w-4 text-white" />
                          </button>
                          <button type="button" onClick={() => { setProofPreview(null); setProofImageUrl("") }} className="p-1.5 bg-muted/50 rounded-lg hover:bg-muted-foreground/20 transition-colors">
                            <X className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-[#4cd7f6]/50 hover:bg-muted/50 transition-all">
                        <ImagePlus className="h-5 w-5 text-slate-500" />
                        <span className="text-xs text-slate-500">Klik untuk upload foto bukti</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProofFile(f) }} />
                      </label>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 bg-muted/50 flex justify-end gap-3 border-t border-border">
                <button type="button" onClick={() => setShowSaldoDialog(null)} className="px-6 py-2 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors">Batal</button>
                <button
                  type="submit"
                  disabled={topUpSaldo.isPending || topDownSaldo.isPending}
                  className={cn(
                    "font-bold px-6 py-2 rounded-lg hover:scale-105 transition-transform disabled:opacity-70 text-sm",
                    showSaldoDialog.type === "topup"
                      ? "bg-gradient-to-br from-tertiary to-tertiary-container text-primary-foreground"
                      : "bg-gradient-to-br from-[#ffb4ab] to-[#ef4444] text-white"
                  )}
                >
                  {(topUpSaldo.isPending || topDownSaldo.isPending) ? "Memproses..." : showSaldoDialog.type === "topup" ? "Top Up" : "Top Down"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof image full-view modal */}
      {showProofModal && proofPreview && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowProofModal(false)}
        >
          <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofPreview} alt="Bukti Transfer" className="w-full rounded-xl shadow-2xl" />
            <button
              onClick={() => setShowProofModal(false)}
              className="absolute top-3 right-3 p-2 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
