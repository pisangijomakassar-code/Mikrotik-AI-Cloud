import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deleteCloudflareTunnel } from "@/lib/services/cloudflare-tunnel.service"
import { deleteSstpTunnel } from "@/lib/services/sstp-tunnel.service"

// GET /api/tunnels/[routerId]
// Returns the tunnel and its ports for a specific router (ownership verified).
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
      include: {
        ports: true,
        router: { select: { name: true } },
      },
    })

    if (!tunnel) {
      return Response.json({ error: "Tunnel not found" }, { status: 404 })
    }

    return Response.json(tunnel)
  } catch (error) {
    console.error("Failed to fetch tunnel:", error)
    return Response.json({ error: "Failed to fetch tunnel" }, { status: 500 })
  }
}

// DELETE /api/tunnels/[routerId]
// Tears down the external tunnel and removes all DB records.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ routerId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { routerId } = await params

  try {
    // Verify ownership
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        routerId,
        router: { userId: session.user.id },
      },
    })

    if (!tunnel) {
      return Response.json({ error: "Tunnel not found" }, { status: 404 })
    }

    // Delete from external service first
    if (tunnel.method === "CLOUDFLARE" && tunnel.cloudflareTunnelId) {
      await deleteCloudflareTunnel(tunnel.cloudflareTunnelId)
    } else if (tunnel.method === "SSTP" && tunnel.vpnUsername) {
      await deleteSstpTunnel(tunnel.vpnUsername)
    }

    // Delete tunnel record (cascade deletes TunnelPort rows)
    await prisma.tunnel.delete({ where: { id: tunnel.id } })

    // Reset the router's connectionMethod back to DIRECT
    await prisma.router.update({
      where: { id: routerId },
      data: { connectionMethod: "DIRECT" },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to delete tunnel:", error)
    return Response.json({ error: "Failed to delete tunnel" }, { status: 500 })
  }
}
