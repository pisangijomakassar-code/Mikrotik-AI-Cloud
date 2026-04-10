"use client"

import { useState } from "react"
import { Wifi, PlusCircle, Trash2, Search, UserX } from "lucide-react"
import { useHotspotUsers, useHotspotProfiles, useRemoveHotspotUser, useEnableHotspotUser, useDisableHotspotUser } from "@/hooks/use-hotspot"
import { AddHotspotUserDialog } from "@/components/dialogs/add-hotspot-user-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function HotspotUsersPage() {
  const [search, setSearch] = useState("")
  const [profileFilter, setProfileFilter] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const { data: users, isLoading } = useHotspotUsers()
  const { data: profiles } = useHotspotProfiles()
  const removeUser = useRemoveHotspotUser()
  const enableUser = useEnableHotspotUser()
  const disableUser = useDisableHotspotUser()

  const filteredUsers = users?.filter((u) => {
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase())
    const matchesProfile = !profileFilter || u.profile === profileFilter
    return matchesSearch && matchesProfile
  })

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

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Hotspot Users</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Wifi className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Manage hotspot user accounts and access control.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search by username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#131b2e] border border-white/5 rounded-lg text-sm pl-10 pr-4 py-2.5 text-[#dae2fd] placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-[#4cd7f6]"
          />
        </div>
        <Select value={profileFilter || "__all__"} onValueChange={(v) => setProfileFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="bg-[#131b2e] border border-white/5 rounded-lg text-sm text-[#dae2fd] w-[180px]">
            <SelectValue placeholder="All Profiles" />
          </SelectTrigger>
          <SelectContent className="bg-[#131b2e] border-white/10 text-[#dae2fd]">
            <SelectItem value="__all__">All Profiles</SelectItem>
            {profiles?.map((p) => (
              <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Username</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Profile</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 hidden md:table-cell">Server</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 hidden md:table-cell">Limit Uptime</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Status</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 hidden md:table-cell">Comment</th>
                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-3 md:px-6 md:py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !filteredUsers?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <UserX className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">No hotspot users found</p>
                      <p className="text-[10px] text-slate-600">Add a user to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.name} className="hover:bg-white/5 transition-colors group">
                    <td className="px-3 py-3 md:px-6 md:py-5">
                      <span className="text-xs md:text-sm font-bold text-[#dae2fd]">{user.name}</span>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-[#222a3d] text-[#4cd7f6] font-medium">
                        {user.profile || "--"}
                      </span>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 text-sm text-slate-400 hidden md:table-cell">
                      {user.server || "all"}
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 text-sm text-slate-400 font-mono-tech hidden md:table-cell">
                      {user["limit-uptime"] || "--"}
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5">
                      <div
                        className={cn(
                          "w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors",
                          user.disabled ? "bg-slate-800" : "bg-[#4ae176]/20"
                        )}
                        onClick={() => handleToggleStatus(user.name, user.disabled)}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-3 h-3 rounded-full transition-all",
                            user.disabled
                              ? "left-1 bg-slate-600"
                              : "right-1 bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.5)]"
                          )}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 text-sm text-slate-400 max-w-[200px] truncate hidden md:table-cell">
                      {user.comment || "--"}
                    </td>
                    <td className="px-3 py-3 md:px-6 md:py-5 text-right">
                      <ConfirmDialog
                        trigger={
                          <button className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        }
                        title={`Delete "${user.name}"?`}
                        description="This will permanently remove this hotspot user. This action cannot be undone."
                        confirmText="Delete User"
                        variant="destructive"
                        onConfirm={() => handleDelete(user.name)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-[10px] md:text-xs text-slate-500">
            Showing {filteredUsers?.length ?? 0} of {users?.length ?? 0} users
          </span>
        </div>
      </div>

      <AddHotspotUserDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  )
}
