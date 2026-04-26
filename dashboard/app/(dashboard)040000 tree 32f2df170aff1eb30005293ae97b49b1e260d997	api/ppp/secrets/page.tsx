"use client"

import { useState } from "react"
import { Network, PlusCircle, Trash2, Search, UserX } from "lucide-react"
import { usePPPSecrets, useRemovePPPSecret } from "@/hooks/use-ppp"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { AddPPPSecretDialog } from "@/components/dialogs/add-ppp-secret-dialog"
import { TableSkeleton } from "@/components/table-skeleton"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function PPPSecretsPage() {
  const [search, setSearch] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const { data: secrets, isLoading } = usePPPSecrets()
  const removeSecret = useRemovePPPSecret()

  const filteredSecrets = secrets?.filter((s: Record<string, unknown>) => {
    if (!search) return true
    const name = (s.name as string) || ""
    return name.toLowerCase().includes(search.toLowerCase())
  })

  function handleDelete(name: string) {
    removeSecret.mutate(name, {
      onSuccess: () => toast.success(`Secret "${name}" deleted`),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">PPP Users</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Network className="h-[18px] w-[18px] text-primary shrink-0" />
            Manage PPP secret accounts for PPPoE, PPTP, L2TP connections.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4" />
            Add Secret
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-low border border-border/20 rounded-lg text-sm pl-10 pr-4 py-2.5 text-foreground placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-[#4cd7f6]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-lowest/80">
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Name</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Service</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Profile</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Local Address</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Remote Address</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Status</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 hidden md:table-cell">Comment</th>
                <th className="px-3 py-2 md:px-4 md:py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                <TableSkeleton rows={5} columns={8} />
              ) : !filteredSecrets?.length ? (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <UserX className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">No PPP secrets found</p>
                      <p className="text-[10px] text-slate-600">Add a secret to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSecrets.map((secret: Record<string, unknown>) => {
                  const disabled = secret.disabled === true || secret.disabled === "true"
                  return (
                    <tr key={secret.name as string} className="hover:bg-muted/50 transition-colors group">
                      <td className="px-3 py-1.5 md:px-4 md:py-2">
                        <span className="text-xs md:text-sm font-bold text-foreground">{secret.name as string}</span>
                      </td>
                      <td className="px-3 py-1.5 md:px-4 md:py-2">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-primary font-medium uppercase">
                          {(secret.service as string) || "any"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm text-slate-400">
                        {(secret.profile as string) || "--"}
                      </td>
                      <td className="px-3 py-1.5 md:px-4 md:py-2 font-mono-tech text-sm text-slate-400 hidden md:table-cell">
                        {(secret["local-address"] as string) || "--"}
                      </td>
                      <td className="px-3 py-1.5 md:px-4 md:py-2 font-mono-tech text-sm text-slate-400 hidden md:table-cell">
                        {(secret["remote-address"] as string) || "--"}
                      </td>
                      <td className="px-3 py-1.5 md:px-4 md:py-2">
                        {disabled ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-error-container/20 text-destructive font-medium">
                            Disabled
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary font-medium">
                            Enabled
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 md:px-4 md:py-2 text-sm text-slate-400 max-w-[160px] truncate hidden md:table-cell">
                        {(secret.comment as string) || "--"}
                      </td>
                      <td className="px-3 py-1.5 md:px-4 md:py-2 text-right">
                        <ConfirmDialog
                          trigger={
                            <button className="w-8 h-8 rounded-lg hover:bg-muted text-slate-500 hover:text-destructive transition-colors flex items-center justify-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          }
                          title={`Delete "${secret.name}"?`}
                          description="This will permanently remove this PPP secret. This action cannot be undone."
                          confirmText="Delete Secret"
                          variant="destructive"
                          onConfirm={() => handleDelete(secret.name as string)}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-lowest/80 flex items-center justify-between border-t border-border/20">
          <span className="text-[10px] md:text-xs text-slate-500">
            Showing {filteredSecrets?.length ?? 0} of {secrets?.length ?? 0} secrets
          </span>
        </div>
      </div>

      <AddPPPSecretDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  )
}
