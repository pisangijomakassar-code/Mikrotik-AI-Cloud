"use client"

import { useState, useCallback } from "react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TenantStatusBadge } from "./tenant-status-badge"
import { EditTenantDialog } from "./edit-tenant-dialog"
import { MoreHorizontal, Search, Router, Users, Pencil, ShieldOff, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow, format, isPast } from "date-fns"

export interface TenantRow {
  id: string
  name: string
  slug: string
  ownerEmail: string
  status: string
  trialEndsAt: string | null
  expiresAt: string | null
  createdAt: string
  _count: { users: number; routers: number }
  subscription?: { plan: string } | null
}

interface Props {
  tenants: TenantRow[]
  loading?: boolean
  onRefresh: () => void
  showSearch?: boolean
}

export function TenantTable({ tenants, loading, onRefresh, showSearch = true }: Props) {
  const [search, setSearch] = useState("")
  const [editTarget, setEditTarget] = useState<TenantRow | null>(null)

  const filtered = search
    ? tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.slug.toLowerCase().includes(search.toLowerCase()) ||
          t.ownerEmail.toLowerCase().includes(search.toLowerCase())
      )
    : tenants

  const setStatus = useCallback(
    async (id: string, status: string) => {
      const res = await fetch(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        toast.success(`Status updated to ${status}`)
        onRefresh()
      } else {
        toast.error("Failed to update status")
      }
    },
    [onRefresh]
  )

  const deleteTenant = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`Mark "${name}" as churned? This is reversible via Edit.`)) return
      const res = await fetch(`/api/platform/tenants/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success(`${name} marked as churned`)
        onRefresh()
      } else {
        toast.error("Failed to churn tenant")
      }
    },
    [onRefresh]
  )

  function expiryLabel(t: TenantRow) {
    const date = t.status === "TRIAL" ? t.trialEndsAt : t.expiresAt
    if (!date) return <span className="text-zinc-600">—</span>
    const d = new Date(date)
    const past = isPast(d)
    return (
      <span className={past ? "text-red-400" : "text-[#869397]"} title={format(d, "dd MMM yyyy")}>
        {past ? "Expired " : ""}{formatDistanceToNow(d, { addSuffix: !past })}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tenants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#869397] font-medium">Tenant</TableHead>
              <TableHead className="text-[#869397] font-medium">Plan</TableHead>
              <TableHead className="text-[#869397] font-medium">Status</TableHead>
              <TableHead className="text-[#869397] font-medium">Expiry</TableHead>
              <TableHead className="text-[#869397] font-medium text-center">
                <span className="flex items-center gap-1 justify-center"><Router className="h-3 w-3" /> Routers</span>
              </TableHead>
              <TableHead className="text-[#869397] font-medium text-center">
                <span className="flex items-center gap-1 justify-center"><Users className="h-3 w-3" /> Users</span>
              </TableHead>
              <TableHead className="text-[#869397] font-medium">Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {search ? "No tenants match your search" : "No tenants found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell>
                    <div className="font-semibold text-sm text-foreground">{t.name}</div>
                    <div className="text-[11px] text-[#869397] font-mono">{t.slug}</div>
                    <div className="text-[11px] text-[#869397]">{t.ownerEmail}</div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-[#4cd7f6]">
                    {t.subscription?.plan ?? "—"}
                  </TableCell>
                  <TableCell>
                    <TenantStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-sm">{expiryLabel(t)}</TableCell>
                  <TableCell className="text-center text-sm font-mono">{t._count.routers}</TableCell>
                  <TableCell className="text-center text-sm font-mono">{t._count.users}</TableCell>
                  <TableCell className="text-sm text-[#869397]">
                    {format(new Date(t.createdAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#0d1929] border-white/10">
                        <DropdownMenuItem onClick={() => setEditTarget(t)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        {t.status !== "ACTIVE" && (
                          <DropdownMenuItem onClick={() => setStatus(t.id, "ACTIVE")}>
                            <ShieldCheck className="h-4 w-4 mr-2 text-[#4ae176]" /> Activate
                          </DropdownMenuItem>
                        )}
                        {t.status !== "SUSPENDED" && (
                          <DropdownMenuItem onClick={() => setStatus(t.id, "SUSPENDED")}>
                            <ShieldOff className="h-4 w-4 mr-2 text-amber-400" /> Suspend
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => deleteTenant(t.id, t.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Mark Churned
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

      <EditTenantDialog
        tenant={editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null) }}
        onUpdated={() => { setEditTarget(null); onRefresh() }}
      />
    </div>
  )
}
