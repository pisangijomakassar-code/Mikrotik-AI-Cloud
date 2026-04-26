"use client"

import { useState } from "react"
import { UserCog, Plus, Pencil, Trash2, FileCode, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/table-skeleton"
import {
  useHotspotProfiles,
  useAddHotspotProfile,
  useUpdateHotspotProfile,
  useDeleteHotspotProfile,
  useIpPools,
  useQueues,
  type HotspotProfile,
  type HotspotProfileInput,
} from "@/hooks/use-hotspot"

const EXPIRED_MODE_OPTIONS = [
  { value: "remove-user-and-record", label: "Remove & Record (hapus + catat)" },
  { value: "no-action", label: "None (tidak ada aksi)" },
]

const EMPTY: HotspotProfileInput = {
  name: "",
  rateLimit: "",
  sharedUsers: 1,
  masaBerlaku: "",
  addressPool: "",
  expiredMode: "remove-user-and-record",
  macCookie: false,
  parentQueue: "",
  onLogin: "",
  onLogout: "",
}

const DEFAULT_ON_LOGIN_SCRIPT = `/ip hotspot user
:local user [find name=$username]
:if ($user != "") do={
  :local comment [get $user comment]
  :local uptime [get $user uptime]
  :log info "Hotspot login: $username, uptime=$uptime"
}`

export default function HotspotProfilesPage() {
  const { data: profiles, isLoading, isError, error } = useHotspotProfiles()
  const addProfile = useAddHotspotProfile()
  const updateProfile = useUpdateHotspotProfile()
  const deleteProfile = useDeleteHotspotProfile()
  const { data: ipPools } = useIpPools()
  const { data: queues } = useQueues()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<HotspotProfile | null>(null)
  const [form, setForm] = useState<HotspotProfileInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [scriptDialog, setScriptDialog] = useState<HotspotProfile | null>(null)
  const [scriptValue, setScriptValue] = useState("")
  const [savingScript, setSavingScript] = useState(false)

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }

  function openEdit(p: HotspotProfile) {
    setEditTarget(p)
    setForm({
      name: p.name,
      rateLimit: p.rateLimit ?? "",
      sharedUsers: Number(p.sharedUsers) || 1,
      masaBerlaku: p.sessionTimeout ?? "",
      addressPool: p.addressPool ?? "",
      expiredMode: p.expiredMode ?? "",
      macCookie: p.macCookie === "true",
      parentQueue: p.parentQueue ?? "",
      onLogin: p.onLogin ?? "",
      onLogout: p.onLogout ?? "",
    })
    setDialogOpen(true)
  }

  function openScript(p: HotspotProfile) {
    setScriptDialog(p)
    setScriptValue(p.onLogin || DEFAULT_ON_LOGIN_SCRIPT)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nama profil wajib diisi"); return }
    setSaving(true)
    try {
      if (editTarget) {
        await updateProfile.mutateAsync({ ...form, name: editTarget.name })
        toast.success(`Profil "${editTarget.name}" diperbarui`)
      } else {
        await addProfile.mutateAsync(form)
        toast.success(`Profil "${form.name}" ditambahkan`)
      }
      setDialogOpen(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan profil"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(name: string) {
    try {
      await deleteProfile.mutateAsync(name)
      toast.success(`Profil "${name}" dihapus`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus profil"
      toast.error(msg)
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleSaveScript() {
    if (!scriptDialog) return
    setSavingScript(true)
    try {
      await updateProfile.mutateAsync({ name: scriptDialog.name, onLogin: scriptValue })
      toast.success("Script On Login disimpan")
      setScriptDialog(null)
    } catch {
      toast.error("Gagal menyimpan script")
    } finally {
      setSavingScript(false)
    }
  }

  const inp = "w-full bg-muted border-none rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"
  const lbl = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">User Profiles</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <UserCog className="h-[18px] w-[18px] text-primary shrink-0" />
            Hotspot user profile configurations. {profiles?.length ?? 0} profiles.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-5 py-2.5 rounded-xl hover:brightness-105 transition-all shrink-0"
        >
          <Plus className="h-4 w-4" /> Add User Profile
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-lowest/80">
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 w-8">No</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Name</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Rate Limit</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Shared Users</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Address Pool</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">On Login</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Operasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                <TableSkeleton rows={4} columns={7} />
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <UserCog className="h-10 w-10 text-destructive/40" />
                      <p className="text-sm text-destructive">Tidak dapat terhubung ke router</p>
                      <p className="text-[10px] text-slate-500">{error instanceof Error ? error.message : "Periksa koneksi ke RouterBoard"}</p>
                    </div>
                  </td>
                </tr>
              ) : !profiles?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <UserCog className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">No hotspot profiles found</p>
                      <p className="text-[10px] text-slate-600">Pastikan router sudah terhubung</p>
                    </div>
                  </td>
                </tr>
              ) : (
                profiles.map((profile, i) => (
                  <tr key={profile.name} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2 text-xs text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2">
                      <span className="text-sm font-bold text-foreground">{profile.name}</span>
                    </td>
                    <td className="px-4 py-2">
                      {profile.rateLimit ? (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-primary font-mono-tech">{profile.rateLimit}</span>
                      ) : <span className="text-xs text-slate-600">--</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-400">{profile.sharedUsers ?? "--"}</td>
                    <td className="px-4 py-2 text-xs text-slate-400 font-mono-tech hidden md:table-cell">{profile.addressPool || "--"}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => openScript(profile)}
                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors ${profile.onLogin ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        title="Edit On Login Script"
                      >
                        <FileCode className="h-3 w-3" />
                        {profile.onLogin ? "Set" : "Kosong"}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(profile)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(profile.name)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Hapus">
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
        <div className="px-6 py-4 bg-surface-lowest/80 border-t border-border/20">
          <span className="text-xs text-slate-500">{profiles?.length ?? 0} profiles</span>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDialogOpen(false)}>
          <div className="bg-surface-low border border-border/20 rounded-3xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border/20">
              <h3 className="text-xl font-headline font-bold text-foreground">
                {editTarget ? `Edit: ${editTarget.name}` : "Add User Profile"}
              </h3>
              <button onClick={() => setDialogOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className={lbl}>Nama Profile *</label>
                <Input className={inp} placeholder="default" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={!!editTarget} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={lbl}>Rate Limit</label>
                  <Input className={inp + " font-mono-tech"} placeholder="1M/2M" value={form.rateLimit} onChange={(e) => setForm((f) => ({ ...f, rateLimit: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className={lbl}>Shared Users</label>
                  <Input className={inp + " font-mono-tech"} type="number" min="1" placeholder="1" value={form.sharedUsers} onChange={(e) => setForm((f) => ({ ...f, sharedUsers: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Masa Berlaku</label>
                <Input className={inp + " font-mono-tech"} placeholder="1h, 24h, 7d, 30d" value={form.masaBerlaku ?? ""} onChange={(e) => setForm((f) => ({ ...f, masaBerlaku: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Expired Mode</label>
                <select className={inp} value={form.expiredMode ?? ""} onChange={(e) => setForm((f) => ({ ...f, expiredMode: e.target.value }))}>
                  {EXPIRED_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Address Pool (dari MikroTik)</label>
                <input
                  list="pool-list"
                  className={inp}
                  placeholder={ipPools?.length ? "Pilih atau ketik nama pool..." : "Ketik nama pool..."}
                  value={form.addressPool ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, addressPool: e.target.value }))}
                />
                <datalist id="pool-list">
                  {ipPools?.map((pool) => (
                    <option key={pool.name} value={pool.name}>{pool.name} ({pool.ranges})</option>
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Parent Queue (dari MikroTik)</label>
                <input
                  list="queue-list"
                  className={inp}
                  placeholder={queues?.length ? "Pilih atau ketik nama queue..." : "Ketik nama queue..."}
                  value={form.parentQueue ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, parentQueue: e.target.value }))}
                />
                <datalist id="queue-list">
                  {queues?.map((q) => <option key={q.name} value={q.name} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Lock User (add-mac-cookie)</label>
                <select
                  className={inp}
                  value={form.macCookie ? "yes" : "no"}
                  onChange={(e) => setForm((f) => ({ ...f, macCookie: e.target.value === "yes" }))}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border/20">
              <button onClick={() => setDialogOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Batal</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-6 py-2.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-60"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : editTarget ? "Simpan" : "Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On Login Script Dialog */}
      {scriptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setScriptDialog(null)}>
          <div className="bg-surface-low border border-border/20 rounded-3xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border/20">
              <div>
                <h3 className="text-xl font-headline font-bold text-foreground">On Login Script</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Profile: <span className="text-primary font-mono-tech">{scriptDialog.name}</span></p>
              </div>
              <button onClick={() => setScriptDialog(null)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-muted-foreground mb-3">Script dieksekusi saat user login. Variabel tersedia: <span className="font-mono-tech text-primary">$username</span>, <span className="font-mono-tech text-primary">$address</span>, <span className="font-mono-tech text-primary">$interface</span>.</p>
              <textarea
                value={scriptValue}
                onChange={(e) => setScriptValue(e.target.value)}
                rows={12}
                className="w-full bg-muted border-none rounded-xl p-4 text-xs font-mono-tech text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder="# MikroTik script..."
                spellCheck={false}
              />
            </div>
            <div className="flex items-center justify-between p-6 border-t border-border/20">
              <button
                onClick={() => setScriptValue("")}
                className="px-4 py-2 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
              >
                Kosongkan Script
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => setScriptDialog(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Batal</button>
                <button
                  onClick={handleSaveScript}
                  disabled={savingScript}
                  className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-6 py-2.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-60"
                >
                  {savingScript ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Script"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-surface-low border border-border/20 rounded-2xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-headline font-bold text-foreground mb-2">Hapus Profile?</h4>
            <p className="text-sm text-muted-foreground mb-1">Profile <span className="text-primary font-mono-tech">{deleteTarget}</span> akan dihapus dari MikroTik.</p>
            <p className="text-xs text-destructive mb-6">Pastikan tidak ada user aktif yang menggunakan profile ini.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Batal</button>
              <button onClick={() => handleDelete(deleteTarget)} className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-bold hover:brightness-105 transition-all">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
