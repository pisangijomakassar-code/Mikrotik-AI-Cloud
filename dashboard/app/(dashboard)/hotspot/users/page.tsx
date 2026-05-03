"use client"

import { useState, useMemo } from "react"
import { Wifi, PlusCircle, Trash2, Search, UserX, UserMinus, Clock, Printer, Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { useHotspotUsers, useRemoveHotspotUser, useEnableHotspotUser, useDisableHotspotUser } from "@/hooks/use-hotspot"
import { useActiveRouter } from "@/components/active-router-context"
import { AddHotspotUserDialog } from "@/components/dialogs/add-hotspot-user-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PrintVoucherSheet } from "@/components/print-voucher-sheet"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/table-skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type SortCol = "name" | "profile" | "server" | "limitUptime" | "comment"
type SortDir = "asc" | "desc"

const PAGE_SIZE = 50

export default function HotspotUsersPage() {
  const [search, setSearch] = useState("")
  const [profileFilter, setProfileFilter] = useState("")
  const [commentSearch, setCommentSearch] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [cleaningUp, setCleaningUp] = useState<"disabled" | "expired" | null>(null)
  const [printVoucher, setPrintVoucher] = useState<{ username: string; password: string; profile: string } | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [page, setPage] = useState(1)

  const { activeRouter } = useActiveRouter()
  const { data: users, isLoading, refetch } = useHotspotUsers(activeRouter || undefined)
  const removeUser = useRemoveHotspotUser()
  const enableUser = useEnableHotspotUser()
  const disableUser = useDisableHotspotUser()

  // Derive profiles directly from loaded users — profiles API endpoint fails (502)
  const profiles = useMemo(() => {
    const names = [...new Set((users ?? []).map((u) => u.profile).filter(Boolean))]
    return names.sort()
  }, [users])

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(col)
      setSortDir("asc")
    }
    setPage(1)
  }

  function resetPage() { setPage(1) }

  async function handleCleanup(type: "disabled" | "expired") {
    setCleaningUp(type)
    try {
      const res = await fetch("/api/hotspot/users/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal cleanup")
      if (data.count === 0) {
        toast.info(data.message || `Tidak ada user ${type === "disabled" ? "disabled" : "expired"} ditemukan`)
      } else {
        const archivedMsg = data.archived > 0 ? ` (${data.archived} dicatat ke DB)` : ""
        toast.success(`${data.count} user dihapus${archivedMsg}`)
        refetch()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal cleanup")
    } finally {
      setCleaningUp(null)
    }
  }


  function handleToggleStatus(username: string, isDisabled: boolean) {
    if (isDisabled) {
      enableUser.mutate(username, {
        onSuccess: () => toast.success(`User "${username}" enabled`),
        onError: (e) => toast.error(e.message),
      })
    } else {
      disableUser.mutate(username, {
        onSuccess: () => toast.success(`User "${username}" disabled`),
        onError: (e) => toast.error(e.message),
      })
    }
  }

  function handleDelete(username: string) {
    removeUser.mutate(username, {
      onSuccess: () => toast.success(`User "${username}" deleted`),
      onError: (e) => toast.error(e.message),
    })
  }

  function handleExportCSV() {
    const rows = filteredSorted
    if (!rows.length) { toast.info("Tidak ada data untuk di-export"); return }
    const header = ["Username", "Password", "Profile", "Server", "Mac Address", "Address", "Limit Uptime", "Status", "Comment"]
    const lines = rows.map((u) => [
      u.name, u.password ?? "", u.profile, u.server ?? "", u.macAddress ?? "",
      u.address ?? "", u.limitUptime ?? "", u.disabled ? "disabled" : "active", u.comment ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `hotspot-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success(`${rows.length} user di-export ke CSV`)
  }

  // 1. Filter
  const filteredSorted = useMemo(() => {
    const filtered = (users ?? []).filter((u) => {
      const matchSearch = !search || (u.name ?? "").toString().toLowerCase().includes(search.toLowerCase())
      const matchProfile = !profileFilter || (u.profile || "").trim().toLowerCase() === profileFilter.trim().toLowerCase()
      const matchComment = !commentSearch || (u.comment || "").toLowerCase().includes(commentSearch.toLowerCase())
      return matchSearch && matchProfile && matchComment
    })
    // 2. Sort
    return [...filtered].sort((a, b) => {
      const av = (a[sortCol] ?? "").toString().toLowerCase()
      const bv = (b[sortCol] ?? "").toString().toLowerCase()
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [users, search, profileFilter, commentSearch, sortCol, sortDir])

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filteredSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 opacity-30" />
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />
  }

  function ThSort({ col, label, className }: { col: SortCol; label: string; className?: string }) {
    return (
      <th
        onClick={() => handleSort(col)}
        className={cn(
          "px-3 py-1 md:px-4 md:py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 cursor-pointer select-none hover:text-primary transition-colors",
          className
        )}
      >
        <div className="flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </div>
      </th>
    )
  }

  return (
    <div>
      {printVoucher && (
        <PrintVoucherSheet
          vouchers={[{ username: printVoucher.username, password: printVoucher.password }]}
          profile={printVoucher.profile}
          onClose={() => setPrintVoucher(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Hotspot Users</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Wifi className="h-[18px] w-[18px] text-primary shrink-0" />
            Manage hotspot user accounts and access control.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ConfirmDialog
            trigger={
              <button
                disabled={!!cleaningUp}
                className="flex items-center gap-2 bg-surface-low border border-white/10 text-slate-300 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-[#1e2a42] hover:text-destructive transition-all disabled:opacity-50"
              >
                <UserMinus className="h-4 w-4" />
                {cleaningUp === "disabled" ? "Menghapus..." : "Hapus Disabled"}
              </button>
            }
            title="Hapus Semua User Disabled?"
            description="Semua hotspot user yang berstatus disabled akan dihapus permanen dari router. Tindakan ini tidak dapat dibatalkan."
            confirmText="Hapus Sekarang"
            variant="destructive"
            onConfirm={() => handleCleanup("disabled")}
          />
          <ConfirmDialog
            trigger={
              <button
                disabled={!!cleaningUp}
                className="flex items-center gap-2 bg-surface-low border border-white/10 text-slate-300 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-[#1e2a42] hover:text-destructive transition-all disabled:opacity-50"
              >
                <Clock className="h-4 w-4" />
                {cleaningUp === "expired" ? "Menghapus..." : "Hapus Expired"}
              </button>
            }
            title="Hapus Semua User Expired?"
            description="Semua hotspot user yang telah melebihi limit uptime atau kuota akan dihapus permanen dari router. Tindakan ini tidak dapat dibatalkan."
            confirmText="Hapus Sekarang"
            variant="destructive"
            onConfirm={() => handleCleanup("expired")}
          />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-surface-low border border-white/10 text-slate-300 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-[#1e2a42] hover:text-primary transition-all"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            type="text"
            placeholder="Cari username..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
            className="w-full bg-surface-low border border-border/20 rounded-lg text-xs pl-9 pr-3 py-2 text-foreground placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={profileFilter}
          onChange={(e) => { setProfileFilter(e.target.value); resetPage() }}
          className="bg-surface-low border border-border/20 rounded-lg text-xs text-foreground px-3 py-2 cursor-pointer outline-none focus:ring-1 focus:ring-primary min-w-[140px]"
        >
          <option value="">Semua Profile ({profiles.length})</option>
          {profiles.map((name) => (
            <option key={name} value={name} className="bg-surface-low">{name}</option>
          ))}
        </select>
        {profileFilter && (
          <button
            type="button"
            onClick={() => { setProfileFilter(""); resetPage() }}
            className="text-[10px] text-slate-400 hover:text-destructive px-2 py-1 rounded border border-border/20 hover:border-destructive/30 transition-colors"
          >
            Clear
          </button>
        )}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            type="text"
            placeholder="Cari comment..."
            value={commentSearch}
            onChange={(e) => { setCommentSearch(e.target.value); resetPage() }}
            className="w-full bg-surface-low border border-border/20 rounded-lg text-xs pl-9 pr-3 py-2 text-foreground placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-lowest/80">
                <th className="px-3 py-1 md:px-4 md:py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 w-8">No</th>
                <ThSort col="name" label="Username" />
                <ThSort col="profile" label="Profile" />
                <ThSort col="server" label="Server" className="hidden md:table-cell" />
                <th className="px-3 py-1 md:px-4 md:py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden lg:table-cell">Mac Address</th>
                <ThSort col="limitUptime" label="Limit Uptime" className="hidden md:table-cell" />
                <th className="px-3 py-1 md:px-4 md:py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Status</th>
                <ThSort col="comment" label="Comment" className="hidden md:table-cell" />
                <th className="px-3 py-1 md:px-4 md:py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                <TableSkeleton rows={10} columns={9} />
              ) : !pageRows.length ? (
                <tr>
                  <td colSpan={9} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <UserX className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">No hotspot users found</p>
                      <p className="text-[10px] text-slate-600">Add a user to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((user, i) => (
                  <tr key={user.name} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-3 py-1 md:px-4 md:py-1.5 text-xs text-slate-600">
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5">
                      <span className="text-xs md:text-sm font-bold text-foreground">{user.name}</span>
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-primary font-medium">
                        {user.profile || "--"}
                      </span>
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5 text-sm text-slate-400 hidden md:table-cell">
                      {user.server || "all"}
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5 text-xs text-slate-400 font-mono hidden lg:table-cell">
                      {user.macAddress || "--"}
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5 text-sm text-slate-400 font-mono-tech hidden md:table-cell">
                      {user.limitUptime || "--"}
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5">
                      <div
                        className={cn(
                          "w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors",
                          user.disabled ? "bg-slate-800" : "bg-tertiary/20"
                        )}
                        onClick={() => handleToggleStatus(user.name, user.disabled)}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-3 h-3 rounded-full transition-all",
                            user.disabled
                              ? "left-1 bg-slate-600"
                              : "right-1 bg-tertiary shadow-[0_0_8px_rgba(74,225,118,0.5)]"
                          )}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5 text-sm text-slate-400 max-w-[200px] truncate hidden md:table-cell">
                      {user.comment || "--"}
                    </td>
                    <td className="px-3 py-1 md:px-4 md:py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Print Voucher"
                          onClick={() => setPrintVoucher({ username: user.name, password: user.password ?? "", profile: user.profile })}
                          className="w-8 h-8 rounded-lg hover:bg-muted text-slate-500 hover:text-primary transition-colors flex items-center justify-center"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button className="w-8 h-8 rounded-lg hover:bg-muted text-slate-500 hover:text-destructive transition-colors flex items-center justify-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          }
                          title={`Delete "${user.name}"?`}
                          description="This will permanently remove this hotspot user. This action cannot be undone."
                          confirmText="Delete User"
                          variant="destructive"
                          onConfirm={() => handleDelete(user.name)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer + Pagination */}
        <div className="px-4 py-3 bg-surface-lowest/80 flex items-center justify-between border-t border-border/20 flex-wrap gap-2">
          <span className="text-[10px] md:text-xs text-slate-500">
            {filteredSorted.length} user
            {(search || profileFilter || commentSearch) ? ` (filter dari ${users?.length ?? 0})` : ""}
            {" · "} hal {safePage}/{totalPages}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="px-2 py-1 rounded text-xs text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >«</button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1 rounded text-xs font-bold text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← Prev</button>
              <span className="text-xs text-slate-500 px-2">{safePage} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1 rounded text-xs font-bold text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >Next →</button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="px-2 py-1 rounded text-xs text-slate-400 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >»</button>
            </div>
          )}
        </div>
      </div>

      <AddHotspotUserDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  )
}
