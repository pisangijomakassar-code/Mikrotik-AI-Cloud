"use client"

import { useState } from "react"
import { CheckCircle2, Copy, Download, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTunnelStatus, useTunnelSetup } from "@/hooks/use-tunnels"
import { TunnelStatusBadge } from "@/components/tunnel-status-badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { TunnelMethod } from "@/lib/types"

interface TunnelSetupWizardProps {
  routerId: string
  method: TunnelMethod
  onClose: () => void
  /** When true, renders as an inline panel (no fullscreen overlay). Used inside TunnelManageDialog. */
  embedded?: boolean
}

function CodeBlock({
  code,
  label,
}: {
  code: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      toast.success("Disalin ke clipboard")
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
          {label}
        </p>
      )}
      <div className="relative group bg-[#0d1323] border border-white/5 rounded-xl overflow-hidden">
        <pre className="p-4 pr-12 text-xs font-mono-tech text-[#4cd7f6] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
          {code}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-[#4cd7f6] transition-colors"
          title="Salin perintah"
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#4ae176]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

function CloudflareInstructions({
  routerId,
  containerCommand,
  deviceModeCommand,
  tunnelToken,
}: {
  routerId: string
  containerCommand?: string
  deviceModeCommand?: string
  tunnelToken?: string
}) {
  const devModeCmd =
    deviceModeCommand ?? "/system/device-mode/update container=yes"
  const containerCmd =
    containerCommand ??
    (tunnelToken
      ? `/container/add remote-image=cloudflare/cloudflared:latest interface=veth1 start-on-boot=yes cmd="tunnel --no-autoupdate run --token ${tunnelToken}"`
      : "Memuat kredensial...")

  function handleDownload() {
    window.open(
      `/api/tunnels/${routerId}/script?type=cloudflare`,
      "_blank"
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#4cd7f6]/5 border border-[#4cd7f6]/20 rounded-xl p-4">
        <p className="text-xs text-[#4cd7f6] font-medium">
          Diperlukan RouterOS 7.x dengan dukungan Container. Pastikan perangkat memiliki memori yang cukup.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#4cd7f6]/20 text-[#4cd7f6] text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <p className="text-sm font-semibold text-[#dae2fd]">Aktifkan mode container</p>
          </div>
          <CodeBlock code={devModeCmd} label="Jalankan di RouterOS Terminal" />
          <p className="text-xs text-slate-500 ml-8">
            Router akan restart otomatis. Tunggu hingga kembali online.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#4cd7f6]/20 text-[#4cd7f6] text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <p className="text-sm font-semibold text-[#dae2fd]">Tambahkan container Cloudflare</p>
          </div>
          <CodeBlock code={containerCmd} label="Jalankan di RouterOS Terminal" />
          <p className="text-xs text-slate-500 ml-8">
            Container akan mengunduh image dan terhubung ke tunnel secara otomatis.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#4cd7f6]/20 text-[#4cd7f6] text-xs font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <p className="text-sm font-semibold text-[#dae2fd]">Atau unduh script lengkap</p>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 text-xs font-bold text-[#4cd7f6] border border-[#4cd7f6]/30 px-4 py-2.5 rounded-xl hover:bg-[#4cd7f6]/10 transition-all ml-8"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh Script Cloudflare (.rsc)
          </button>
        </div>
      </div>
    </div>
  )
}

function SstpInstructions({
  routerId,
  sstpCommand,
  vpnHost,
  vpnUsername,
  vpnPassword,
}: {
  routerId: string
  sstpCommand?: string
  vpnHost?: string
  vpnUsername?: string
  vpnPassword?: string
}) {
  const cmd =
    sstpCommand ??
    (vpnHost && vpnUsername && vpnPassword
      ? `/interface sstp-client add connect-to=${vpnHost} name=sstp-tunnel user=${vpnUsername} password=${vpnPassword} add-default-route=no profile=default-encryption`
      : "Memuat kredensial...")

  function handleDownload() {
    window.open(`/api/tunnels/${routerId}/script?type=sstp`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
        <p className="text-xs text-amber-400 font-medium">
          Kompatibel dengan RouterOS 6.x. Menggunakan SSTP VPN built-in, tidak memerlukan Docker.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <p className="text-sm font-semibold text-[#dae2fd]">Tambahkan SSTP client</p>
          </div>
          <CodeBlock code={cmd} label="Jalankan di RouterOS Terminal" />
          <p className="text-xs text-slate-500 ml-8">
            SSTP client akan terhubung ke VPN server dan mendapatkan IP yang telah ditetapkan.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-400/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <p className="text-sm font-semibold text-[#dae2fd]">Atau unduh script lengkap</p>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 text-xs font-bold text-amber-400 border border-amber-400/30 px-4 py-2.5 rounded-xl hover:bg-amber-400/10 transition-all ml-8"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh Script SSTP (.rsc)
          </button>
        </div>
      </div>
    </div>
  )
}

function LinuxInstructions({ routerId }: { routerId: string }) {
  function handleDownload() {
    window.open(`/api/tunnels/${routerId}/script?type=linux`, "_blank")
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#4ae176]/5 border border-[#4ae176]/20 rounded-xl p-4">
        <p className="text-xs text-[#4ae176] font-medium">
          Gunakan perangkat Linux (Raspberry Pi, server, dll) sebagai companion untuk meneruskan koneksi.
        </p>
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 text-xs font-bold text-[#4ae176] border border-[#4ae176]/30 px-4 py-2.5 rounded-xl hover:bg-[#4ae176]/10 transition-all"
      >
        <Download className="h-3.5 w-3.5" />
        Unduh Script Linux (.sh)
      </button>
    </div>
  )
}

export function TunnelSetupWizard({
  routerId,
  method,
  onClose,
  embedded = false,
}: TunnelSetupWizardProps) {
  const statusQuery = useTunnelStatus(routerId, true)
  const setupQuery = useTunnelSetup(routerId, true)

  const currentStatus = statusQuery.data?.status ?? "PENDING"
  const isConnected = currentStatus === "CONNECTED"
  const isPending = currentStatus === "PENDING"

  const footerNote = isPending
    ? "Halaman ini akan otomatis update saat tunnel terhubung."
    : isConnected
    ? "Tunnel aktif."
    : "Periksa perintah di atas dan pastikan router dapat diakses."

  const successBanner = isConnected ? (
    <div className="mx-6 mt-4 p-3 bg-[#4ae176]/10 border border-[#4ae176]/20 rounded-xl flex items-center gap-3 shrink-0">
      <CheckCircle2 className="h-4 w-4 text-[#4ae176] shrink-0" />
      <p className="text-xs text-[#4ae176] font-medium">
        Tunnel berhasil terhubung! AI Agent sudah bisa mengakses router.
      </p>
    </div>
  ) : null

  // Shared body content (tabs with setup instructions)
  const bodyContent = (
    <div className={cn("overflow-y-auto", embedded ? "p-4 pb-2" : "flex-1 p-6")}>
      {setupQuery.isLoading ? (
        <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Memuat instruksi setup...</span>
        </div>
      ) : (
        <Tabs defaultValue="routeros">
          <TabsList className="bg-[#0d1323] border border-white/5 mb-6">
            <TabsTrigger value="routeros" className="text-xs data-[state=active]:text-[#dae2fd]">
              RouterOS
            </TabsTrigger>
            <TabsTrigger value="linux" className="text-xs data-[state=active]:text-[#dae2fd]">
              Linux Companion
            </TabsTrigger>
          </TabsList>
          <TabsContent value="routeros">
            {method === "CLOUDFLARE" ? (
              <CloudflareInstructions
                routerId={routerId}
                containerCommand={setupQuery.data?.containerCommand}
                deviceModeCommand={setupQuery.data?.deviceModeCommand}
                tunnelToken={setupQuery.data?.tunnelToken}
              />
            ) : (
              <SstpInstructions
                routerId={routerId}
                sstpCommand={setupQuery.data?.sstpCommand}
                vpnHost={setupQuery.data?.vpnHost}
                vpnUsername={setupQuery.data?.vpnUsername}
                vpnPassword={setupQuery.data?.vpnPassword}
              />
            )}
          </TabsContent>
          <TabsContent value="linux">
            <LinuxInstructions routerId={routerId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )

  // Embedded mode: render as a plain panel inside parent Dialog
  if (embedded) {
    return (
      <div className="flex flex-col">
        {successBanner}
        {bodyContent}
        <div className="px-6 pb-4 pt-2">
          <p className="text-[10px] text-slate-500">{footerNote}</p>
        </div>
      </div>
    )
  }

  // Standalone fullscreen overlay mode
  const accentColor = method === "CLOUDFLARE" ? "#4cd7f6" : "#f59e0b"

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-slate-950/60 backdrop-blur-md">
      <div className="w-full max-w-2xl mx-4 bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-start justify-between shrink-0">
          <div className="space-y-2">
            <h3 className="text-xl font-headline font-bold text-[#dae2fd]">
              Setup Tunnel
            </h3>
            <div className="flex items-center gap-3">
              <TunnelStatusBadge status={currentStatus} method={method} showMethod />
              {isPending && (
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Menunggu koneksi...
                </span>
              )}
              {isConnected && (
                <span className="flex items-center gap-1.5 text-[10px] text-[#4ae176] font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Tunnel aktif
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-[#dae2fd] transition-colors shrink-0 ml-4"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Connection success banner */}
        {successBanner}

        {/* Body */}
        {bodyContent}

        {/* Footer */}
        <div
          className="p-6 border-t border-white/5 flex items-center justify-between shrink-0"
          style={{ backgroundColor: "rgba(13, 19, 35, 0.5)" }}
        >
          <p className="text-[10px] text-slate-500">{footerNote}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-[#dae2fd] font-bold transition-colors"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-headline font-bold transition-all",
                isConnected
                  ? "bg-[#4ae176] text-[#003915] hover:brightness-110"
                  : isPending
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "text-[#003640] hover:scale-105",
              )}
              style={
                !isConnected && !isPending
                  ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }
                  : undefined
              }
            >
              {isConnected ? "Selesai" : isPending ? "Menunggu..." : "Selesai"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
