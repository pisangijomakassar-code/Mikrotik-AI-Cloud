import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getCloudflareTunnelStatus } from "@/lib/services/cloudflare-tunnel.service"
import { getSstpTunnelStatus } from "@/lib/services/sstp-tunnel.service"
import { agentFetch } from "@/lib/agent-fetch"

// VPN IPs (10.8.x.y for WG, 10.9.x.y for OVPN) hanya reachable dari container
// VPN-nya sendiri. Dashboard delegasi probe ke agent yang execute `nc` di
// dalam container `mikrotik-openvpn` / `mikrotik-wireguard`.
//
// Cache 30 detik per (vpnIp, port) supaya banyak dashboard tab yang polling
// 5-30 detik tidak menggandakan beban `docker exec nc` ke openvpn container.
const PROBE_CACHE_TTL_MS = 30_000
const probeCache = new Map<string, { ok: boolean; at: number }>()

async function vpnProbe(vpnIp: string, port: number): Promise<boolean> {
  const key = `${vpnIp}:${port}`
  const cached = probeCache.get(key)
  const now = Date.now()
  if (cached && now - cached.at < PROBE_CACHE_TTL_MS) return cached.ok

  let ok = false
  try {
    const res = await agentFetch(`/tunnel-probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vpnIp, port }),
      signal: AbortSignal.timeout(12_000),
    })
    if (res.ok) {
      const data = (await res.json()) as { reachable?: boolean }
      ok = data.reachable === true
    }
  } catch {
    ok = false
  }
  probeCache.set(key, { ok, at: now })
  return ok
}

// GET /api/tunnels/[routerId]/status
// Polls the external service for live tunnel status and syncs it to the DB.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ routerId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { routerId } = await params

  try {
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        routerId,
        router: { tenantId: session.user.tenantId ?? "__none__" },
      },
    })

    if (!tunnel) {
      return Response.json({ error: "Tunnel not found" }, { status: 404 })
    }

    // Query the live status from the external service
    let liveStatus: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR"

    if (tunnel.method === "CLOUDFLARE" && tunnel.cloudflareTunnelId) {
      liveStatus = await getCloudflareTunnelStatus(tunnel.cloudflareTunnelId)
    } else if (tunnel.method === "SSTP" && tunnel.vpnUsername) {
      liveStatus = await getSstpTunnelStatus(tunnel.vpnUsername)
    } else if (
      (tunnel.method === "OVPN" || tunnel.method === "WIREGUARD") &&
      tunnel.vpnAssignedIp
    ) {
      // Probe API port (8728) lewat VPN IP via agent — kalau bisa konek,
      // berarti router aktif di tunnel.
      const reachable = await vpnProbe(tunnel.vpnAssignedIp, 8728)
      liveStatus = reachable ? "CONNECTED" : "PENDING"
    } else {
      liveStatus = "PENDING"
    }

    // Update DB only when status has actually changed
    const updateData: { status: typeof liveStatus; lastConnectedAt?: Date } = {
      status: liveStatus,
    }
    if (liveStatus === "CONNECTED" && tunnel.status !== "CONNECTED") {
      updateData.lastConnectedAt = new Date()
    }

    const updated = await prisma.tunnel.update({
      where: { id: tunnel.id },
      data: updateData,
      select: { status: true, lastConnectedAt: true },
    })

    return Response.json({
      status: updated.status,
      lastConnectedAt: updated.lastConnectedAt,
    })
  } catch (error) {
    console.error("Failed to fetch tunnel status:", error)
    return Response.json(
      { error: "Failed to fetch tunnel status" },
      { status: 500 }
    )
  }
}
