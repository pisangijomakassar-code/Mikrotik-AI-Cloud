"use client"

import { useState } from "react"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUpdateTunnelPort } from "@/hooks/use-tunnels"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import type { Tunnel, TunnelPort } from "@/lib/types"

const MAX_ENABLED_PORTS = 5

interface TunnelPortListProps {
  tunnel: Tunnel
  onTogglePort?: (portId: string, enabled: boolean) => void
}

function getConnectionInfo(port: TunnelPort, tunnel: Tunnel): string {
  if (tunnel.method === "CLOUDFLARE") {
    return port.hostname ?? "—"
  }
  // SSTP
  if (tunnel.vpnAssignedIp) {
    return `${tunnel.vpnAssignedIp}:${port.remotePort}`
  }
  return "—"
}

const SERVICE_LABEL: Record<string, string> = {
  api: "API",
  winbox: "Winbox",
  ssh: "SSH",
  webfig: "WebFig",
  "api-ssl": "API-SSL",
}

export function TunnelPortList({ tunnel, onTogglePort }: TunnelPortListProps) {
  const updatePort = useUpdateTunnelPort()
  const [pendingPortId, setPendingPortId] = useState<string | null>(null)

  const enabledCount = tunnel.ports.filter((p) => p.enabled).length

  async function handleToggle(port: TunnelPort, checked: boolean) {
    if (port.serviceName === "api") return

    if (checked && enabledCount >= MAX_ENABLED_PORTS) {
      toast.error(`Maksimal ${MAX_ENABLED_PORTS} port dapat diaktifkan sekaligus.`)
      return
    }

    setPendingPortId(port.id)
    try {
      await updatePort.mutateAsync({
        routerId: tunnel.routerId,
        portId: port.id,
        enabled: checked,
      })
      onTogglePort?.(port.id, checked)
      toast.success(
        checked
          ? `Port ${port.serviceName} (${port.remotePort}) diaktifkan`
          : `Port ${port.serviceName} (${port.remotePort}) dinonaktifkan`
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingPortId(null)
    }
  }

  const isConnected = tunnel.status === "CONNECTED"

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-white/5 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Port Tunnel
          </span>
          <span className="text-[10px] text-slate-500">
            {enabledCount}/{MAX_ENABLED_PORTS} aktif
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0d1323]/50">
                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Layanan
                </th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Port
                </th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Koneksi
                </th>
                <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">
                  Aktif
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tunnel.ports.map((port) => {
                const isRequired = port.serviceName === "api"
                const isPending = pendingPortId === port.id
                const connectionInfo = getConnectionInfo(port, tunnel)

                return (
                  <tr
                    key={port.id}
                    className={cn(
                      "transition-colors",
                      isRequired ? "opacity-80" : "hover:bg-white/3"
                    )}
                  >
                    {/* Service Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#dae2fd]">
                          {SERVICE_LABEL[port.serviceName] ?? port.serviceName}
                        </span>
                        {isRequired && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="h-3 w-3 text-slate-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Diperlukan untuk AI Agent
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>

                    {/* Port */}
                    <td className="px-4 py-3">
                      <span className="font-mono-tech text-xs text-[#4cd7f6] bg-[#06b6d4]/10 px-2 py-0.5 rounded-lg">
                        {port.remotePort}
                      </span>
                    </td>

                    {/* Connection Info */}
                    <td className="px-4 py-3 max-w-[220px]">
                      {isConnected && connectionInfo !== "—" ? (
                        <span
                          className="font-mono-tech text-[10px] text-slate-400 truncate block"
                          title={connectionInfo}
                        >
                          {connectionInfo}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </td>

                    {/* Toggle */}
                    <td className="px-4 py-3 text-right">
                      {isRequired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex justify-end">
                              <Switch
                                checked={true}
                                disabled
                                size="sm"
                                className="opacity-50 cursor-not-allowed data-[state=checked]:bg-[#4cd7f6]/40"
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Tidak dapat dinonaktifkan — diperlukan untuk AI Agent
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Switch
                          checked={port.enabled}
                          disabled={isPending}
                          size="sm"
                          onCheckedChange={(checked) => handleToggle(port, checked)}
                          className="data-[state=checked]:bg-[#4cd7f6]"
                        />
                      )}
                    </td>
                  </tr>
                )
              })}

              {tunnel.ports.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500">
                    Belum ada port dikonfigurasi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Warning if at max */}
        {enabledCount >= MAX_ENABLED_PORTS && (
          <div className="px-4 py-2.5 bg-amber-400/5 border-t border-amber-400/10">
            <p className="text-[10px] text-amber-400">
              Batas maksimal {MAX_ENABLED_PORTS} port aktif tercapai. Nonaktifkan satu port untuk mengaktifkan yang lain.
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
