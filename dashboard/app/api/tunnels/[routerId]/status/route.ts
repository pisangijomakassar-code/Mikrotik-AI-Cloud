import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getCloudflareTunnelStatus } from "@/lib/services/cloudflare-tunnel.service"
import { getSstpTunnelStatus } from "@/lib/services/sstp-tunnel.service"
import net from "net"

// Cek konektivitas TCP ke vpn_ip:port. Dipakai untuk OVPN/WG karena OS-level
// service-nya tdk punya endpoint status terpisah — kalau router-nya konek ke
// VPN, port API-nya (8728) accessible dari VPS.
function tcpProbe(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => done(true))
    socket.once("error", () => done(false))
    socket.once("timeout", () => done(false))
    socket.connect(port, host)
  })
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
        router: { userId: session.user.id },
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
      // TCP probe ke API port (8728) router lewat VPN IP — kalau bisa konek,
      // berarti router aktif di tunnel.
      const reachable = await tcpProbe(tunnel.vpnAssignedIp, 8728, 2000)
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
