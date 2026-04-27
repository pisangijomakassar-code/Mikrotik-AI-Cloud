"use client"

import { useState } from "react"
import { Pencil, Trash2, SlidersHorizontal, Download, ChevronLeft, ChevronRight, Lock, LockOpen, CalendarDays, X } from "lucide-react"
import { useUsers, useUpdateUser, useDeleteUser } from "@/hooks/use-users"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EditUserDialog } from "@/components/edit-user-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return ""
  return new Date(dateStr).toISOString().slice(0, 10)
}

function ExpiryCell({ user, onSave }: {
  user: { id: string; validUntil: string | null }
  onSave: (id: string, validUntil: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(toDateInputValue(user.validUntil))

  const now = new Date()
  const expiry = user.validUntil ? new Date(user.validUntil) : null
  const isExpired = expiry ? expiry < now : false
  const isSoon = expiry ? !isExpired && expiry.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 : false

  function handleSave() {
    onSave(user.id, value || null)
    setOpen(false)
  }

  function handleClear() {
    setValue("")
    onSave(user.id, null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 text-xs font-mono-tech px-2 py-1 rounded-lg transition-colors",
            isExpired
              ? "text-destructive bg-destructive/10 hover:bg-destructive/20"
              : isSoon
              ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
              : expiry
              ? "text-tertiary bg-tertiary/10 hover:bg-tertiary/20"
              : "text-muted-foreground/50 bg-muted/50 hover:bg-muted"
          )}
        >
          <CalendarDays className="h-3 w-3 shrink-0" />
          {expiry ? formatDate(user.validUntil) : "No limit"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-card border-border p-4 space-y-3" align="start">
        <p className="text-xs font-bold text-foreground">Set Expiry Date</p>
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="bg-muted border-border text-sm h-9"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Save
          </button>
          {user.validUntil && (
            <button
              onClick={handleClear}
              className="h-8 px-3 rounded-lg bg-muted text-muted-foreground text-xs hover:text-destructive transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function UserTable() {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  const derivedStatus = activeTab === "active" ? "ACTIVE" : activeTab === "suspended" ? "SUSPENDED" : undefined

  const filter = {
    search: search || undefined,
    status: derivedStatus as "ACTIVE" | "INACTIVE" | "SUSPENDED" | undefined,
    role: (roleFilter || undefined) as "ADMIN" | "USER" | undefined,
  }

  const { data: users, isLoading } = useUsers(filter)
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  function handleStatusToggle(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    updateUser.mutate(
      { id: userId, data: { status: newStatus as "ACTIVE" | "INACTIVE" } },
      {
        onSuccess: () => toast.success(`User ${newStatus.toLowerCase()}`),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  function handleLockToggle(userId: string, currentLocked: boolean) {
    updateUser.mutate(
      { id: userId, data: { isLocked: !currentLocked } },
      {
        onSuccess: () => toast.success(currentLocked ? "User unlocked" : "User locked"),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  function handleValidUntilChange(userId: string, validUntil: string | null) {
    updateUser.mutate(
      { id: userId, data: { validUntil: validUntil ? new Date(validUntil) : null } },
      {
        onSuccess: () => toast.success(validUntil ? "Expiry date set" : "Expiry date cleared"),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  function handleDelete(userId: string) {
    deleteUser.mutate(userId, {
      onSuccess: () => toast.success("User deleted"),
      onError: (e) => toast.error(e.message),
    })
  }

  function maskToken(token: string | null): string {
    if (!token) return "--"
    return token.slice(0, 10) + "..."
  }

  return (
    <>
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-card p-1.5 rounded-lg border border-border">
          {[
            { key: "all", label: "All Users" },
            { key: "active", label: "Active" },
            { key: "suspended", label: "Suspended" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-5 py-1.5 font-bold text-xs rounded-lg transition-colors",
                activeTab === tab.key
                  ? "bg-muted text-primary"
                  : "text-muted-foreground/70 hover:text-muted-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm transition-colors",
              showFilters ? "text-primary border-primary/30" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            More Filters
          </button>
          <button
            onClick={() => toast.info("Export coming soon")}
            className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded-lg text-muted-foreground hover:text-primary transition-colors"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex items-center gap-3 bg-card p-3 rounded-lg border border-border">
          <Input
            type="text"
            placeholder="Search by name, email, or Telegram ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-muted border-none rounded-lg text-sm px-4 py-2 text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-1 focus:ring-primary"
          />
          <Select
            value={roleFilter || "__all__"}
            onValueChange={(value) => setRoleFilter(value === "__all__" ? "" : value)}
          >
            <SelectTrigger className="bg-muted border-none rounded-lg text-sm px-4 py-2 text-foreground outline-none w-auto h-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              <SelectItem value="__all__">All Roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="USER">User</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => { setSearch(""); setRoleFilter(""); setActiveTab("all"); setShowFilters(false) }}
            className="text-xs text-muted-foreground/70 hover:text-primary transition-colors px-3"
          >
            Reset
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">User ID (Telegram)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Telegram Bot Token</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Routers</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border">Expires</th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !users?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-muted-foreground">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/40 transition-colors group">
                    <td className="px-6 py-5 font-mono-tech text-primary text-sm">
                      {user.telegramId}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xs font-bold text-primary border border-border">
                          {getInitials(user.name)}
                        </div>
                        <span className="text-sm font-bold text-foreground">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-mono-tech text-xs px-2 py-1 rounded-lg text-muted-foreground/70 bg-muted/50">
                        {maskToken(user.botToken)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-foreground">
                        {user._count?.routers ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {user.status === "ACTIVE" ? (
                          <div
                            className="w-10 h-5 bg-[#4ae176]/20 rounded-full relative p-1 cursor-pointer"
                            onClick={() => handleStatusToggle(user.id, user.status)}
                          >
                            <div className="absolute right-1 top-1 w-3 h-3 bg-[#4ae176] rounded-full shadow-[0_0_8px_rgba(74,225,118,0.5)]" />
                          </div>
                        ) : (
                          <div
                            className="w-10 h-5 bg-muted/80 rounded-full relative p-1 cursor-pointer"
                            onClick={() => handleStatusToggle(user.id, user.status)}
                          >
                            <div className="absolute left-1 top-1 w-3 h-3 bg-muted-foreground/70 rounded-full" />
                          </div>
                        )}
                        {/* Agent provisioned indicator */}
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            user.isProvisioned
                              ? "bg-[#4ae176] shadow-[0_0_6px_rgba(74,225,118,0.6)]"
                              : "bg-muted-foreground/30"
                          )}
                          title={user.isProvisioned ? "Agent active" : "Agent inactive"}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <ExpiryCell user={user} onSave={handleValidUntilChange} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="w-8 h-8 rounded-lg hover:bg-muted/40 text-muted-foreground/70 hover:text-primary transition-colors flex items-center justify-center"
                          onClick={() => setEditingUserId(user.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className={cn(
                            "w-8 h-8 rounded-lg transition-colors flex items-center justify-center",
                            user.isLocked
                              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              : "hover:bg-muted/40 text-muted-foreground/70 hover:text-amber-400"
                          )}
                          onClick={() => handleLockToggle(user.id, user.isLocked)}
                          title={user.isLocked ? "Unlock user" : "Lock user"}
                        >
                          {user.isLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button className="w-8 h-8 rounded-lg hover:bg-muted/40 text-muted-foreground/70 hover:text-destructive transition-colors flex items-center justify-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          }
                          title={`Delete "${user.name}"?`}
                          description="This will permanently delete this user and all their registered routers. This action cannot be undone."
                          confirmText="Delete User"
                          variant="destructive"
                          onConfirm={() => handleDelete(user.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-muted/50 flex items-center justify-between border-t border-border">
          <span className="text-xs text-muted-foreground/70">
            Showing {users?.length ?? 0} of {users?.length ?? 0} users
          </span>
          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-muted rounded-lg disabled:opacity-30" disabled>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground rounded-lg">1</button>
            </div>
            <button className="p-1 hover:bg-muted rounded-lg">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Edit User Dialog */}
    {editingUserId && (() => {
      const u = users?.find((x) => x.id === editingUserId)
      if (!u) return null
      return (
        <EditUserDialog
          user={u}
          open={true}
          onClose={() => setEditingUserId(null)}
        />
      )
    })()}
    </>
  )
}
