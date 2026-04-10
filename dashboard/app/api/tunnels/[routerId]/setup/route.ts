import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateSstpRouterConfig } from "@/lib/services/sstp-tunnel.service"

// GET /api/tunnels/[routerId]/setup
// Returns everything the user needs to configure their router.
// For SSTP, vpnPassword is stored as-is by createSstpTunnel (plaintext) and
// returned here for display — no additional decryption step is required.
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
      include: { ports: true },
    })

    if (!tunnel) {
      return Response.json({ error: "Tunnel not found" }, { status: 404 })
    }

    if (tunnel.method === "CLOUDFLARE") {
      return Response.json({
        method: "CLOUDFLARE",
        // Field name matches TunnelSetupResponse.tunnelToken in use-tunnels.ts
        tunnelToken: tunnel.cloudflareTunnelToken,
        ports: tunnel.ports,
        routerLanIp: tunnel.routerLanIp,
      })
    }

    // SSTP
    const vpnHost = process.env.SSTP_SERVER_HOST || ""
    // Field name matches TunnelSetupResponse.sstpCommand in use-tunnels.ts
    const sstpCommand =
      tunnel.vpnUsername && tunnel.vpnPassword
        ? generateSstpRouterConfig({
            vpnHost,
            vpnUsername: tunnel.vpnUsername,
            vpnPassword: tunnel.vpnPassword,
          })
        : null

    return Response.json({
      method: "SSTP",
      vpnHost,
      vpnUsername: tunnel.vpnUsername,
      vpnPassword: tunnel.vpnPassword, // plaintext — see sstp-tunnel.service.ts
      sstpCommand,
      ports: tunnel.ports,
      routerLanIp: tunnel.routerLanIp,
    })
  } catch (error) {
    console.error("Failed to fetch tunnel setup:", error)
    return Response.json(
      { error: "Failed to fetch tunnel setup" },
      { status: 500 }
    )
  }
}
