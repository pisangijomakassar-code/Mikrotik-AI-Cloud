"use client"

import { useState } from "react"
import { Ticket, Plus, Pencil, Trash2, Search, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableSkeleton } from "@/components/table-skeleton"
import { formatRupiah } from "@/lib/formatters"
import {
  useVoucherTypes,
  useCreateVoucherType,
  useUpdateVoucherType,
  useDeleteVoucherType,
  type VoucherTypeData,
  type VoucherTypeInput,
} from "@/hooks/use-voucher-types"
import { useHotspotProfiles, useHotspotServers } from "@/hooks/use-hotspot"

const TYPE_CHAR_OPTIONS = [
  "Random abcd2345",
  "Random ABCD2345",
  "Random aBcD2345",
  "Random 5ab2c34d",
  "Random 5AB2C34D",
  "Random 5aB2c34D",
  "Random 1234",
]

const TYPE_LOGIN_OPTIONS = [
  "Username & Password",
  "Username = Password",
]

const VOUCHER_GROUPS = ["default", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

const EMPTY: VoucherTypeInput = {
  namaVoucher: "",
  deskripsi: "",
  harga: 0,
  markUp: 0,
  server: "all",
  profile: "",
  limitUptime: "0",
  limitQuotaDl: 0,
  limitQuotaUl: 0,
  limitQuotaTotal: 0,
  typeChar: "Random abcd",
  typeLogin: "Username = Password",
  prefix: "",
  panjangKarakter: 6,
  voucherGroup: "default",
  voucherColor: "#ffffff",
}

export default function VouchersSettingsPage() {
  const { data: vouchers, isLoading } = useVoucherTypes()
  const createVt = useCreateVoucherType()
  const updateVt = useUpdateVoucherType()
  const deleteVt = useDeleteVoucherType()
  const { data: hotspotProfiles } = useHotspotProfiles()
  const { data: hotspotServers } = useHotspotServers()

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<VoucherTypeData | null>(null)
  const [form, setForm] = useState<VoucherTypeInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = (vouchers ?? []).filter((v) =>
    v.namaVoucher.toLowerCase().includes(search.toLowerCase()) ||
    v.profile.toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }

  function openEdit(v: VoucherTypeData) {
    setEditTarget(v)
    setForm({
      namaVoucher: v.namaVoucher,
      deskripsi: v.deskripsi,
      harga: v.harga,
      markUp: v.markUp,
      server: v.server,
      profile: v.profile,
      limitUptime: v.limitUptime,
      limitQuotaDl: v.limitQuotaDl,
      limitQuotaUl: v.limitQuotaUl,
      limitQuotaTotal: v.limitQuotaTotal,
      typeChar: v.typeChar,
      typeLogin: v.typeLogin,
      prefix: v.prefix,
      panjangKarakter: v.panjangKarakter,
      voucherGroup: v.voucherGroup,
      voucherColor: v.voucherColor,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.namaVoucher.trim()) { toast.error("Nama voucher wajib diisi"); return }
    setSaving(true)
    try {
      if (editTarget) {
        await updateVt.mutateAsync({ id: editTarget.id, ...form })
        toast.success("Jenis voucher diperbarui")
      } else {
        await createVt.mutateAsync(form)
        toast.success("Jenis voucher ditambahkan")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Gagal menyimpan jenis voucher")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVt.mutateAsync(id)
      toast.success("Jenis voucher dihapus")
    } catch {
      toast.error("Gagal menghapus jenis voucher")
    } finally {
      setDeleteId(null)
    }
  }

  const inp = "w-full bg-muted border-none rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"
  const lbl = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-1">Jenis Voucher</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Ticket className="h-[18px] w-[18px] text-primary shrink-0" />
            Kelola jenis voucher untuk bot Telegram reseller.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-5 py-2.5 rounded-xl hover:brightness-105 transition-all shrink-0"
        >
          <Plus className="h-4 w-4" /> Tambah Voucher
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Cari nama voucher, profile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Nama Voucher</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Profile</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Harga</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Mark Up</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Limit Uptime</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Group VCR</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell">Prefix</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell">Tipe Karakter</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell">VCR CLR</th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Operasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                <TableSkeleton rows={5} columns={11} />
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={11} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Ticket className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">Belum ada jenis voucher</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v, i) => (
                  <tr key={v.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-1.5 text-xs text-slate-500">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <div className="font-bold text-sm text-foreground">{v.namaVoucher}</div>
                      {v.deskripsi && <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{v.deskripsi}</div>}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-primary font-mono-tech">{v.profile || "-"}</td>
                    <td className="px-3 py-1.5 text-xs font-mono-tech text-tertiary">{formatRupiah(v.harga)}</td>
                    <td className="px-3 py-1.5 text-xs font-mono-tech text-slate-400">+{formatRupiah(v.markUp)}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-400 hidden md:table-cell">{v.limitUptime || "-"}</td>
                    <td className="px-3 py-1.5 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {v.voucherGroup.split(",").map((g) => (
                          <span key={g} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">{g.trim()}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-xs font-mono-tech text-slate-500 hidden lg:table-cell">{v.prefix || "-"}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-400 hidden lg:table-cell">{v.typeChar}</td>
                    <td className="px-3 py-1.5 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded border border-white/10" style={{ backgroundColor: v.voucherColor }} />
                        <span className="text-[10px] font-mono-tech text-slate-500">{v.voucherColor}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(v.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-surface-lowest/80 border-t border-border/20">
          <span className="text-xs text-slate-500">{filtered.length} jenis voucher</span>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDialogOpen(false)}>
          <div className="bg-surface-low border border-border/20 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border/20 sticky top-0 bg-surface-low z-10">
              <h3 className="text-xl font-headline font-bold text-foreground">
                {editTarget ? "Edit Jenis Voucher" : "Tambah Jenis Voucher"}
              </h3>
              <button onClick={() => setDialogOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Nama & Deskripsi */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Nama Voucher *</label>
                  <Input className={inp} placeholder="Voucher 1 Hari" value={form.namaVoucher} onChange={(e) => setForm((f) => ({ ...f, namaVoucher: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Deskripsi</label>
                  <Input className={inp} placeholder="Keterangan tambahan" value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} />
                </div>
              </div>

              {/* Harga & MarkUp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Harga (Rp)</label>
                  <Input className={inp + " font-mono-tech"} type="number" min="0" placeholder="5000" value={form.harga} onChange={(e) => setForm((f) => ({ ...f, harga: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Mark Up (Rp)</label>
                  <Input className={inp + " font-mono-tech"} type="number" min="0" placeholder="0" value={form.markUp} onChange={(e) => setForm((f) => ({ ...f, markUp: Number(e.target.value) }))} />
                </div>
              </div>

              {/* Server & Profile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Server</label>
                  <select
                    className={inp}
                    value={form.server}
                    onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))}
                  >
                    <option value="all">all (semua server)</option>
                    {(hotspotServers ?? []).map((s) => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Profile Hotspot</label>
                  <select
                    className={inp}
                    value={form.profile}
                    onChange={(e) => setForm((f) => ({ ...f, profile: e.target.value }))}
                  >
                    <option value="">— Pilih Profile —</option>
                    {(hotspotProfiles ?? []).map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Limit Uptime */}
              <div className="space-y-1.5">
                <label className={lbl}>Limit Uptime</label>
                <Input className={inp} placeholder="1d, 12h, 4w3d — kosongkan jika tidak ada" value={form.limitUptime === "0" ? "" : form.limitUptime} onChange={(e) => setForm((f) => ({ ...f, limitUptime: e.target.value || "0" }))} />
              </div>

              {/* Quota */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Quota DL (MB)</label>
                  <Input className={inp + " font-mono-tech"} type="number" min="0" placeholder="0" value={form.limitQuotaDl} onChange={(e) => setForm((f) => ({ ...f, limitQuotaDl: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Quota UL (MB)</label>
                  <Input className={inp + " font-mono-tech"} type="number" min="0" placeholder="0" value={form.limitQuotaUl} onChange={(e) => setForm((f) => ({ ...f, limitQuotaUl: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Quota Total (MB)</label>
                  <Input className={inp + " font-mono-tech"} type="number" min="0" placeholder="0" value={form.limitQuotaTotal} onChange={(e) => setForm((f) => ({ ...f, limitQuotaTotal: Number(e.target.value) }))} />
                </div>
              </div>

              {/* Char & Login type, prefix, length */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Tipe Karakter</label>
                  <Select value={form.typeChar} onValueChange={(v) => setForm((f) => ({ ...f, typeChar: v }))}>
                    <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border text-foreground">
                      {TYPE_CHAR_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Tipe Login</label>
                  <Select value={form.typeLogin} onValueChange={(v) => setForm((f) => ({ ...f, typeLogin: v }))}>
                    <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border text-foreground">
                      {TYPE_LOGIN_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Prefix</label>
                  <Input className={inp + " font-mono-tech"} placeholder="VCR-" value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Panjang Karakter (3–8)</label>
                  <Select value={String(form.panjangKarakter)} onValueChange={(v) => setForm((f) => ({ ...f, panjangKarakter: Number(v) }))}>
                    <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border text-foreground">
                      {[3, 4, 5, 6, 7, 8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Voucher Group (multi-select via toggle) */}
              <div className="space-y-2">
                <label className={lbl}>Group Voucher (multi)</label>
                <div className="flex flex-wrap gap-2">
                  {VOUCHER_GROUPS.map((g) => {
                    const groups = form.voucherGroup.split(",").map((x) => x.trim()).filter(Boolean)
                    const active = groups.includes(g)
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          let next: string[]
                          if (active) {
                            next = groups.filter((x) => x !== g)
                            if (!next.length) next = ["default"]
                          } else {
                            next = [...groups, g]
                          }
                          setForm((f) => ({ ...f, voucherGroup: next.join(",") }))
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20"}`}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* VCR CLR (Telegram only) */}
              <div className="space-y-1.5">
                <label className={lbl}>VCR CLR — Warna Voucher Telegram</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.voucherColor}
                    onChange={(e) => setForm((f) => ({ ...f, voucherColor: e.target.value }))}
                    className="h-10 w-12 rounded-lg border-none bg-muted cursor-pointer p-1"
                  />
                  <Input
                    className={inp + " font-mono-tech max-w-[120px]"}
                    value={form.voucherColor}
                    onChange={(e) => setForm((f) => ({ ...f, voucherColor: e.target.value }))}
                    maxLength={7}
                  />
                  <span className="text-[10px] text-muted-foreground/60">Hanya tampil di voucher Telegram, bukan cetak fisik</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border/20 sticky bottom-0 bg-surface-low">
              <button onClick={() => setDialogOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-6 py-2.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-60"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : editTarget ? "Simpan Perubahan" : "Tambah Voucher"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
          <div className="bg-surface-low border border-border/20 rounded-2xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-headline font-bold text-foreground mb-2">Hapus Jenis Voucher?</h4>
            <p className="text-sm text-muted-foreground mb-6">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Batal</button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-bold hover:brightness-105 transition-all"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
