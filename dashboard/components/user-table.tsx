"use client"

import { useState } from "react"
import { Pencil, Trash2, SlidersHorizontal, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { useUsers, useUpdateUser, useDeleteUser } from "@/hooks/use-users"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function UserTable() {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [roleFilter, setRoleFilter] = useState<string>("")

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

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-[#131b2e] p-1.5 rounded-lg border border-white/5">
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
                  ? "bg-[#222a3d] text-[#4cd7f6]"
                  : "text-slate-500 hover:text-slate-300"
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
              "flex items-center gap-2 px-4 py-2 bg-[#131b2e] border border-white/5 rounded-lg text-sm transition-colors",
              showFilters ? "text-[#4cd7f6] border-[#4cd7f6]/30" : "text-slate-400 hover:bg-[#222a3d]"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            More Filters
          </button>
          <button
            onClick={() => toast.info("Export coming soon")}
            className="flex items-center justify-center w-10 h-10 bg-[#131b2e] border border-white/5 rounded-lg text-slate-400 hover:text-[#4cd7f6] transition-colors"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex items-center gap-3 bg-[#131b2e] p-3 rounded-lg border border-white/5">
          <input
            type="text"
            placeholder="Search by name, email, or Telegram ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-[#222a3d] border-none rounded-lg text-sm px-4 py-2 text-[#dae2fd] placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-[#4cd7f6]"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#222a3d] border-none rounded-lg text-sm px-4 py-2 text-[#dae2fd] outline-none"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>
          <button
            onClick={() => { setSearch(""); setRoleFilter(""); setActiveTab("all"); setShowFilters(false) }}
            className="text-xs text-slate-500 hover:text-[#4cd7f6] transition-colors px-3"
          >
            Reset
          </button>
        </div>
      )}

      {/* Glass-morphism Table */}
      <div className="glass-panel border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.3)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-8 py-5">User ID (Telegram)</th>
                <th className="px-6 py-5">Name</th>
                <th className="px-6 py-5">Telegram Bot Token</th>
                <th className="px-6 py-5">Routers Count</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Created Date</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
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
              ) : !users?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-5 font-mono-tech text-cyan-400 text-sm">
                      {user.telegramId}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#2d3449] flex items-center justify-center text-xs font-bold text-[#4cd7f6]">
                          {getInitials(user.name)}
                        </div>
                        <span className="text-[#dae2fd] font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono-tech text-xs text-slate-500">
                      {maskToken(user.botToken)}
                      <span className="text-[8px] opacity-30">{"••••••••••"}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="bg-[#222a3d] px-2 py-1 rounded text-xs text-[#dae2fd] border border-white/5">
                        {user._count?.routers ?? 0} Units
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {user.status === "ACTIVE" ? (
                        <div
                          className="w-10 h-5 bg-[#4ae176]/20 rounded-full relative p-1 cursor-pointer"
                          onClick={() => handleStatusToggle(user.id, user.status)}
                        >
                          <div className="absolute right-1 top-1 w-3 h-3 bg-[#4ae176] rounded-full shadow-[0_0_8px_rgba(74,225,118,0.5)]" />
                        </div>
                      ) : (
                        <div
                          className="w-10 h-5 bg-slate-800 rounded-full relative p-1 cursor-pointer"
                          onClick={() => handleStatusToggle(user.id, user.status)}
                        >
                          <div className="absolute left-1 top-1 w-3 h-3 bg-slate-600 rounded-full" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#4cd7f6] transition-colors flex items-center justify-center"
                          onClick={() => toast.info("Edit user coming soon")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
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
        <div className="px-8 py-4 bg-white/[0.02] border-t border-white/[0.05] flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Showing {users?.length ?? 0} of {users?.length ?? 0} users
          </p>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-500 hover:text-[#dae2fd] transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs font-bold px-3 py-1 bg-[#06b6d4]/10 text-[#4cd7f6] rounded-lg border border-[#06b6d4]/20">1</span>
            <button className="p-2 text-slate-500 hover:text-[#dae2fd] transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
