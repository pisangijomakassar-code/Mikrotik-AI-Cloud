"use client"

import { useState } from "react"
import { Network, BookOpen, PlugZap, Trash2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { TableSkeleton } from "@/components/table-skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TunnelStatusBadge } from "@/components/tunnel-status-badge"
import { TunnelPortList } from "@/components/tunnel-port-list"
import { TunnelSetupWizard } from "@/components/tunnel-setup-wizard"
import { useTunnel, useDeleteTunnel } from "@/hooks/use-tunnels"
import type { TunnelMethod, TunnelStatus } from "@/lib/types"

interface TunnelManageDialogProps {
  routerId: string
  routerName: string
  tunnelMethod: TunnelMethod
  tunnelStatus: TunnelStatus | null | undefined
}

export function TunnelManageDialog({
  routerId,
  routerName,
  tunnelMethod,
  tunnelStatus,
}: TunnelManageDialogProps) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { data: tunnel, isLoading } = useTunnel(routerId, open)
  const deleteTunnel = useDeleteTunnel()

  function handleDelete() {
    deleteTunnel.mutate(routerId, {
      onSuccess: () => {
        toast.success("Tunnel berhasil dihapus")
        setOpen(false)
        setConfirmDelete(false)
      },
      onError: (err) => {
        toast.error(err.message)
        setConfirmDelete(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmDelete(false) }}>
      <DialogTrigger asChild>
        <button
          title="Manage Tunnel"
          className="w-8 h-8 rounded-lg hover:bg-muted/40 text-[#4cd7f6]/70 hover:text-[#4cd7f6] transition-colors flex items-center justify-center"
        >
          <Network className="h-4 w-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl bg-[#0e1525] border-white/10 text-[#dae2fd] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-bold text-[#dae2fd] flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-[#4cd7f6]" />
                Tunnel — {routerName}
              </DialogTitle>
              <p className="text-[11px] text-slate-500 mt-1">
                {tunnelMethod === "CLOUDFLARE" ? "Cloudflare Tunnel (RouterOS 7+)" : "SSTP VPN (RouterOS 6)"}
              </p>
            </div>
            <TunnelStatusBadge status={tunnelStatus} method={tunnelMethod} showMethod />
          </div>
        </DialogHeader>

        <Tabs defaultValue="ports" className="flex flex-col">
          <TabsList className="mx-6 mt-4 mb-0 bg-[#131b2e] border border-white/5 self-start">
            <TabsTrigger
              value="ports"
              className="text-[11px] data-[state=active]:bg-[#222a3d] data-[state=active]:text-[#4cd7f6]"
            >
              <Network className="h-3.5 w-3.5 mr-1.5" />
              Port Tunnel
            </TabsTrigger>
            <TabsTrigger
              value="setup"
              className="text-[11px] data-[state=active]:bg-[#222a3d] data-[state=active]:text-[#4cd7f6]"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Instruksi Setup
            </TabsTrigger>
          </TabsList>

          {/* Tab: Port Management */}
          <TabsContent value="ports" className="px-6 py-4 mt-0">
            {isLoading ? (
              <TableSkeleton rows={3} columns={4} />
            ) : tunnel ? (
              <TunnelPortList tunnel={tunnel} />
            ) : (
              <p className="text-sm text-slate-500 py-6 text-center">Gagal memuat data tunnel.</p>
            )}
          </TabsContent>

          {/* Tab: Setup Instructions */}
          <TabsContent value="setup" className="mt-0">
            <TunnelSetupWizard
              routerId={routerId}
              method={tunnelMethod}
              onClose={() => setOpen(false)}
              embedded
            />
          </TabsContent>
        </Tabs>

        {/* Delete section */}
        <div className="px-6 py-4 border-t border-white/5 mt-2">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-[11px] font-bold text-[#ffb4ab]/70 hover:text-[#ffb4ab] transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Tunnel
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-[#ffb4ab]/5 border border-[#ffb4ab]/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-[#ffb4ab] shrink-0" />
              <p className="text-[11px] text-slate-400 flex-1">
                Tunnel akan dihapus permanen. Router kembali ke mode koneksi langsung.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-300 font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteTunnel.isPending}
                  className="text-[11px] font-bold bg-[#ffb4ab]/15 text-[#ffb4ab] hover:bg-[#ffb4ab]/25 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleteTunnel.isPending ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
