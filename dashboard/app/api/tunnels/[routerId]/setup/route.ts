import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateSstpRouterConfig } from "@/lib/services/sstp-tunnel.service"
import { generateOvpnScript } from "@/lib/services/ovpn-tunnel.service"
import { generateWireguardScript } from "@/lib/services/wg-tunnel.service"

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
    if (tunnel.method === "SSTP") {
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
    }

    if (tunnel.method === "OVPN") {
      const vpsHost = process.env.VPS_HOST || ""
      const script = tunnel.vpnUsername && tunnel.vpnPassword
        ? generateOvpnScript({
            vpsHost,
            vpnIp: tunnel.vpnAssignedIp ?? "",
            ovpnHost: vpsHost,
            username: tunnel.vpnUsername,
            password: tunnel.vpnPassword,  // stored plaintext by ovpn service
            winboxPort: tunnel.winboxPort ?? 0,
          })
        : null

      return Response.json({
        method: "OVPN",
        vpsHost,
        username: tunnel.vpnUsername,
        password: tunnel.vpnPassword,
        vpnIp: tunnel.vpnAssignedIp,
        winboxPort: tunnel.winboxPort,
        script,
        ports: tunnel.ports,
      })
    }

    if (tunnel.method === "WIREGUARD") {
      const vpsHost = process.env.VPS_HOST || ""
      const script = tunnel.wgServerPubKey
        ? generateWireguardScript({
            vpsHost,
            vpnIp: tunnel.vpnAssignedIp ?? "",
            serverPubKey: tunnel.wgServerPubKey,
            clientPrivKey: tunnel.wgClientPrivKey ?? "",  // encrypted — displayed as-is or decrypted upstream
            winboxPort: tunnel.winboxPort ?? 0,
          })
        : null

      return Response.json({
        method: "WIREGUARD",
        vpsHost,
        vpnIp: tunnel.vpnAssignedIp,
        winboxPort: tunnel.winboxPort,
        serverPubKey: tunnel.wgServerPubKey,
        clientPubKey: tunnel.wgClientPubKey,
        script,
        ports: tunnel.ports,
      })
    }
  } catch (error) {
    console.error("Failed to fetch tunnel setup:", error)
    return Response.json(
      { error: "Failed to fetch tunnel setup" },
      { status: 500 }
    )
  }
}
