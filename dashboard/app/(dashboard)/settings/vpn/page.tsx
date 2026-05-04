"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { Download, Shield, ShieldOff, Wifi, WifiOff, MonitorDot, Info } from "lucide-react"
import { toast } from "sonner"

interface VpnStatus {
  provisioned: boolean
  vpnIp: string | null
  routers: { name: string; label: string; host: string; connectionMethod: string }[]
}

function downloadConf(conf: string, filename: string) {
  const blob = new Blob([conf], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminVpnPage() {
  const qc = useQueryClient()
  const [conf, setConf] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ["admin-vpn-status"],
    queryFn: () => apiClient.get<VpnStatus>("/api/vpn"),
  })

  const activateMutation = useMutation({
    mutationFn: () => apiClient.post<{ provisioned: boolean; vpnIp: string; conf?: string; alreadyProvisioned?: boolean }>("/api/vpn", {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-vpn-status"] })
      if (data.alreadyProvisioned) {
        toast.info("VPN sudah aktif. Download ulang config tidak tersedia — hapus dulu lalu aktifkan kembali.")
        return
      }
      if (data.conf) {
        setConf(data.conf)
        downloadConf(data.conf, "mikrotikai-vpn.conf")
        toast.success("VPN berhasil diaktifkan! File config sudah terdownload.")
      }
    },
    onError: () => toast.error("Gagal mengaktifkan VPN"),
  })

  const revokeMutation = useMutation({
    mutationFn: () => apiClient.delete("/api/vpn"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vpn-status"] })
      setConf(null)
      toast.success("VPN berhasil dinonaktifkan")
    },
    onError: () => toast.error("Gagal menonaktifkan VPN"),
  })

  const status = statusQuery.data
  const isProvisioned = status?.provisioned ?? false
  const loading = statusQuery.isLoading

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Admin VPN</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Akses Winbox router kamu dari PC lewat WireGuard — tanpa port forward publik.
        </p>
      </div>

      {/* Status card */}
      <div className="card-glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
          ) : isProvisioned ? (
            <Wifi className="h-5 w-5 text-tertiary" />
          ) : (
            <WifiOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {loading ? "Memuat..." : isProvisioned ? "VPN Aktif" : "VPN Belum Dikonfigurasi"}
            </p>
            {isProvisioned && status?.vpnIp && (
              <p className="text-xs text-muted-foreground">IP kamu: <span className="font-mono text-tertiary">{status.vpnIp}</span></p>
            )}
          </div>
        </div>

        {/* Router list */}
        {isProvisioned && status?.routers && status.routers.length > 0 && (
          <div className="border-t border-border/40 pt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Router yang bisa diakses via Winbox
            </p>
            {status.routers.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MonitorDot className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground">{r.label || r.name}</span>
                </div>
                <span className="font-mono text-muted-foreground">{r.host}</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground/60 pt-1">
              Setelah WireGuard terhubung, buka Winbox → isi alamat IP di atas → Connect.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          {!isProvisioned ? (
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="flex items-center gap-2 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              {activateMutation.isPending ? "Menyiapkan..." : "Aktifkan VPN"}
            </button>
          ) : (
            <>
              {conf && (
                <button
                  onClick={() => downloadConf(conf, "mikrotikai-vpn.conf")}
                  className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
                >
                  <Download className="h-4 w-4" />
                  Download Config
                </button>
              )}
              <button
                onClick={() => revokeMutation.mutate()}
                disabled={revokeMutation.isPending}
                className="flex items-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                <ShieldOff className="h-4 w-4" />
                {revokeMutation.isPending ? "Menghapus..." : "Nonaktifkan VPN"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cara pakai */}
      <div className="card-glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Cara Pakai</p>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>Klik <strong className="text-foreground">Aktifkan VPN</strong> — file <code className="text-xs bg-muted px-1 rounded">mikrotikai-vpn.conf</code> akan otomatis terdownload.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>Install <strong className="text-foreground">WireGuard</strong> di PC kamu dari <code className="text-xs bg-muted px-1 rounded">wireguard.com/install</code> (pilih Windows).</span>
          </li>
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>Buka WireGuard → <strong className="text-foreground">Add Tunnel</strong> → pilih file <code className="text-xs bg-muted px-1 rounded">.conf</code> yang didownload → klik <strong className="text-foreground">Activate</strong>.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
            <span>Buka <strong className="text-foreground">Winbox</strong> → isi alamat IP router di atas → masukkan username/password router → Connect.</span>
          </li>
        </ol>
        <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Internet tidak terganggu</strong> — hanya traffic ke jaringan internal (<code>10.8.x.x</code>) yang lewat VPN. Browsing tetap langsung seperti biasa.
        </div>
      </div>
    </div>
  )
}
