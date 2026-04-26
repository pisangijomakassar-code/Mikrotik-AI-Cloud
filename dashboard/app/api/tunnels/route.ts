import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createCloudflareTunnel } from "@/lib/services/cloudflare-tunnel.service"
import { createSstpTunnel } from "@/lib/services/sstp-tunnel.service"
import { createWireguardTunnel } from "@/lib/services/wg-tunnel.service"
import { createOvpnTunnel } from "@/lib/services/ovpn-tunnel.service"
import { TUNNEL_SERVICES } from "@/lib/types"
import { PLAN_LIMITS, type PlanKey } from "@/lib/constants/plan-limits"

// GET /api/tunnels
// Returns all tunnels with their ports for the current user's routers.
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const tunnels = await prisma.tunnel.findMany({
      where: {
        router: {
          userId: session.user.id,
        },
      },
      include: {
        ports: true,
        router: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(tunnels)
  } catch (error) {
    console.error("Failed to fetch tunnels:", error)
    return Response.json({ error: "Failed to fetch tunnels" }, { status: 500 })
  }
}

// POST /api/tunnels
// Activates a tunnel for an existing DIRECT router.
// Body: { routerId, method: "CLOUDFLARE" | "SSTP", routerLanIp?, enabledPorts? }
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { routerId, method, routerLanIp, enabledPorts } = body

    if (!routerId || !method) {
      return Response.json({ error: "routerId and method are required" }, { status: 400 })
    }

    // Verify the router belongs to a user this admin can manage
    const router = await prisma.router.findUnique({ where: { id: routerId } })
    if (!router) {
      return Response.json({ error: "Router not found" }, { status: 404 })
    }

    // Check tunnel doesn't already exist
    const existing = await prisma.tunnel.findUnique({ where: { routerId } })
    if (existing) {
      return Response.json({ error: "Tunnel already exists for this router" }, { status: 409 })
    }

    // Determine allowed ports based on the router owner's subscription plan
    const ownerSubscription = await prisma.subscription.findUnique({
      where: { userId: router.userId },
      select: { plan: true },
    })
    const ownerPlan = (ownerSubscription?.plan ?? "FREE") as PlanKey
    const { allowedTunnelPorts } = PLAN_LIMITS[ownerPlan]

    const lanIp = routerLanIp ?? "192.168.88.1"

    if (method === "CLOUDFLARE") {
      const requestedServices: string[] =
        Array.isArray(enabledPorts) && enabledPorts.length > 0
          ? enabledPorts
          : ["api", "winbox"]

      const ports = requestedServices
        .map((sn: string) => TUNNEL_SERVICES.find((s) => s.serviceName === sn))
        .filter(Boolean)
        .map((s) => ({ serviceName: s!.serviceName, remotePort: s!.remotePort }))

      const { tunnelId, token, ports: cfPorts } = await createCloudflareTunnel(
        router.id,
        lanIp,
        ports
      )

      const tunnel = await prisma.tunnel.create({
        data: {
          method: "CLOUDFLARE",
          cloudflareTunnelId: tunnelId,
          cloudflareTunnelToken: token,
          routerLanIp: lanIp,
          routerId: router.id,
          ports: {
            create: cfPorts.map((p) => ({
              serviceName: p.serviceName,
              remotePort:
                TUNNEL_SERVICES.find((s) => s.serviceName === p.serviceName)?.remotePort ?? 0,
              hostname: p.hostname,
              enabled: true,
            })),
          },
        },
        include: { ports: true },
      })

      await prisma.router.update({
        where: { id: router.id },
        data: { connectionMethod: "TUNNEL" },
      })

      return Response.json(tunnel, { status: 201 })
    }

    if (method === "SSTP") {
      const { username, password, vpnIp } = await createSstpTunnel(router.id, prisma)

      const tunnel = await prisma.tunnel.create({
        data: {
          method: "SSTP",
          vpnUsername: username,
          vpnPassword: password,
          vpnAssignedIp: vpnIp,
          routerLanIp: lanIp,
          routerId: router.id,
          ports: {
            create: TUNNEL_SERVICES.map((s) => ({
              serviceName: s.serviceName,
              remotePort: s.remotePort,
              enabled: allowedTunnelPorts.includes(s.serviceName),
            })),
          },
        },
        include: { ports: true },
      })

      await prisma.router.update({
        where: { id: router.id },
        data: { connectionMethod: "TUNNEL" },
      })

      return Response.json(tunnel, { status: 201 })
    }

    if (method === "OVPN") {
      const { username, password, vpnIp, winboxPort, subnetOctet, routerOctet } =
        await createOvpnTunnel(router.id, prisma)

      const tunnel = await prisma.tunnel.create({
        data: {
          method: "OVPN",
          vpnUsername: username,
          vpnPassword: password,
          vpnAssignedIp: vpnIp,
          winboxPort,
          subnetOctet,
          routerOctet,
          routerLanIp: lanIp,
          routerId: router.id,
          ports: {
            create: TUNNEL_SERVICES.filter(s =>
              allowedTunnelPorts.includes(s.serviceName)
            ).map((s) => ({
              serviceName: s.serviceName,
              remotePort: s.remotePort,
              enabled: true,
            })),
          },
        },
        include: { ports: true },
      })

      await prisma.router.update({
        where: { id: router.id },
        data: { connectionMethod: "TUNNEL" },
      })

      return Response.json(tunnel, { status: 201 })
    }

    if (method === "WIREGUARD") {
      const { clientPrivKey, clientPubKey, serverPubKey, vpnIp, winboxPort, subnetOctet, routerOctet } =
        await createWireguardTunnel(router.id, prisma)

      const tunnel = await prisma.tunnel.create({
        data: {
          method: "WIREGUARD",
          vpnAssignedIp: vpnIp,
          winboxPort,
          subnetOctet,
          routerOctet,
          wgClientPrivKey: clientPrivKey,
          wgClientPubKey: clientPubKey,
          wgServerPubKey: serverPubKey,
          routerLanIp: lanIp,
          routerId: router.id,
          ports: {
            create: TUNNEL_SERVICES.filter(s =>
              allowedTunnelPorts.includes(s.serviceName)
            ).map((s) => ({
              serviceName: s.serviceName,
              remotePort: s.remotePort,
              enabled: true,
            })),
          },
        },
        include: { ports: true },
      })

      await prisma.router.update({
        where: { id: router.id },
        data: { connectionMethod: "TUNNEL" },
      })

      return Response.json(tunnel, { status: 201 })
    }

    return Response.json({ error: "Invalid method. Use CLOUDFLARE, SSTP, OVPN or WIREGUARD." }, { status: 400 })
  } catch (error: unknown) {
    console.error("Failed to create tunnel:", error)
    const message = error instanceof Error ? error.message : "Failed to create tunnel"
    return Response.json({ error: message }, { status: 500 })
  }
}
