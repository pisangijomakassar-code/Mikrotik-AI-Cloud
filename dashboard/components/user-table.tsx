"use client"

import { useState } from "react"
import { MoreHorizontal, Search, Eye, EyeOff, Download, SlidersHorizontal } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUsers, useUpdateUser, useDeleteUser } from "@/hooks/use-users"
import { AddUserDialog } from "@/components/add-user-dialog"
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
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("all")
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set())

  const derivedStatus = activeTab === "active" ? "ACTIVE" : activeTab === "suspended" ? "SUSPENDED" : (statusFilter as "ACTIVE" | "INACTIVE" | "SUSPENDED") || undefined

  const filter = {
    search: search || undefined,
    status: derivedStatus,
  }

  const { data: users, isLoading } = useUsers(filter)
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  function toggleTokenVisibility(userId: string) {
    setRevealedTokens((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function maskToken(token: string | null): string {
    if (!token) return "--"
    return token.slice(0, 6) + "..." + token.slice(-4)
  }

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

  function handleDelete(userId: string, userName: string) {
    if (!confirm(`Delete user "${userName}"? This action cannot be undone.`)) return
    deleteUser.mutate(userId, {
      onSuccess: () => toast.success("User deleted"),
      onError: (e) => toast.error(e.message),
    })
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}>
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
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-[#4cd7f6] text-[#4cd7f6]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-0"
              style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)' }}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 border-0 text-muted-foreground" style={{ background: 'rgba(45, 52, 73, 0.6)' }}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            More Filters
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-0 text-muted-foreground" style={{ background: 'rgba(45, 52, 73, 0.6)' }}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
        <AddUserDialog />
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent" style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">User ID</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Bot Token</TableHead>
              <TableHead className="text-center text-xs uppercase tracking-wider text-muted-foreground">Routers</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !users?.length ? (
              <TableRow style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderColor: 'rgba(61, 73, 76, 0.15)' }}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {user.telegramId}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        {user.email && (
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-technical)' }}>
                        {revealedTokens.has(user.id)
                          ? user.botToken || "--"
                          : maskToken(user.botToken)}
                      </span>
                      {user.botToken && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => toggleTokenVisibility(user.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {revealedTokens.has(user.id) ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm text-foreground">
                      {user._count?.routers ?? 0}{" "}
                      <span className="text-xs text-muted-foreground">Units</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(user.lastActive)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            user.status === "ACTIVE" && "bg-[#4ae176]",
                            user.status === "INACTIVE" && "bg-muted-foreground",
                            user.status === "SUSPENDED" && "bg-[#ffb4ab]"
                          )}
                        />
                        <span className={cn(
                          "text-xs",
                          user.status === "ACTIVE" && "text-[#4ae176]",
                          user.status === "INACTIVE" && "text-muted-foreground",
                          user.status === "SUSPENDED" && "text-[#ffb4ab]"
                        )}>
                          {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36" style={{ background: 'rgba(45, 52, 73, 0.95)', backdropFilter: 'blur(20px)' }}>
                        <DropdownMenuItem
                          onClick={() =>
                            handleStatusToggle(user.id, user.status)
                          }
                        >
                          {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(user.id, user.name)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
