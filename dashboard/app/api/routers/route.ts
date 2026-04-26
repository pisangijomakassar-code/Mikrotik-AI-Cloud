import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getRouters, createRouter } from "@/lib/services/router.service"
import { createCloudflareTunnel } from "@/lib/services/cloudflare-tunnel.service"
import { createSstpTunnel } from "@/lib/services/sstp-tunnel.service"
import { TUNNEL_SERVICES } from "@/lib/types"
import { PLAN_LIMITS } from "@/lib/constants/plan-limits"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") ?? undefined

    // Non-admin users only see their own routers
    const userId =
      session.user.role === "ADMIN" ? undefined : session.user.id

    const routers = await getRouters(userId, search)
    return Response.json(routers)
  } catch (error) {
    console.error("Failed to fetch routers:", error)
    return Response.json(
      { error: "Failed to fetch routers" },
      { status: 500 }
    )
  }
}

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

    if (!body.name || !body.host || !body.username || !body.password || !body.userId) {
      return Response.json(
        { error: "Name, host, username, password, and userId are required" },
        { status: 400 }
      )
    }

    // Enforce router limit based on target user's subscription plan
    const targetSub = await prisma.$queryRawUnsafe<Array<{ plan: string }>>(
      `SELECT plan FROM "Subscription" WHERE "userId" = $1 LIMIT 1`,
      body.userId as string
    ).then((rows) => rows[0] ?? { plan: "FREE" })

    const planLimits = PLAN_LIMITS[targetSub.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.FREE
    const existingCount = await prisma.router.count({ where: { userId: body.userId as string } })

    if (existingCount >= planLimits.maxRouters) {
      return Response.json(
        {
          error: "router_limit_exceeded",
          message: `Plan ${targetSub.plan} hanya mendukung maksimal ${planLimits.maxRouters} router. Saat ini: ${existingCount}.`,
          limit: planLimits.maxRouters,
          current: existingCount,
        },
        { status: 409 }
      )
    }

    const router = await createRouter(body)

    // ── Tunnel provisioning (optional) ────────────────────────────────────────
    const { connectionMethod, tunnelMethod, routerLanIp, enabledPorts } = body

    if (connectionMethod === "TUNNEL") {
      try {
        if (tunnelMethod === "CLOUDFLARE") {
          // Determine which ports to expose; default to api + winbox
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
            routerLanIp ?? "192.168.88.1",
            ports
          )

          await prisma.tunnel.create({
            data: {
              method: "CLOUDFLARE",
              cloudflareTunnelId: tunnelId,
              cloudflareTunnelToken: token,
              routerLanIp: routerLanIp ?? "192.168.88.1",
              routerId: router.id,
              ports: {
                create: cfPorts.map((p) => ({
                  serviceName: p.serviceName,
                  remotePort:
                    TUNNEL_SERVICES.find((s) => s.serviceName === p.serviceName)
                      ?.remotePort ?? 0,
                  hostname: p.hostname,
                  enabled: true,
                })),
              },
            },
          })
        } else if (tunnelMethod === "SSTP") {
          const { username, password, vpnIp } = await createSstpTunnel(
            router.id,
            prisma
          )

          await prisma.tunnel.create({
            data: {
              method: "SSTP",
              vpnUsername: username,
              vpnPassword: password,
              vpnAssignedIp: vpnIp,
              routerLanIp: routerLanIp ?? "192.168.88.1",
              routerId: router.id,
              ports: {
                // All services are reachable over the VPN tunnel
                create: TUNNEL_SERVICES.map((s) => ({
                  serviceName: s.serviceName,
                  remotePort: s.remotePort,
                  enabled: true,
                })),
              },
            },
          })
        }

        // Mark router as TUNNEL connection
        await prisma.router.update({
          where: { id: router.id },
          data: { connectionMethod: "TUNNEL" },
        })
      } catch (tunnelError) {
        // Tunnel creation failed — clean up the router record to avoid orphans
        console.error("Tunnel provisioning failed, rolling back router:", tunnelError)
        await prisma.router.delete({ where: { id: router.id } }).catch(() => {})
        throw tunnelError
      }
    }

    return Response.json(router, { status: 201 })
  } catch (error: unknown) {
    console.error("Failed to create router:", error)
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A router with this name already exists for this user"
        : "Failed to create router"
    return Response.json({ error: message }, { status: 400 })
  }
}
