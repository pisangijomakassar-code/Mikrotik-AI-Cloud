import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PLAN_LIMITS, type PlanKey } from "@/lib/constants/plan-limits"

// PATCH /api/tunnels/[routerId]/ports
// Body: { portId: string, enabled: boolean }
// Enables or disables a TunnelPort. The 'api' port cannot be disabled because
// it is required for the MCP server to communicate with the router.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ routerId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { routerId } = await params

  try {
    const body = await request.json() as { portId?: string; enabled?: boolean }

    if (typeof body.portId !== "string" || typeof body.enabled !== "boolean") {
      return Response.json(
        { error: "portId (string) and enabled (boolean) are required" },
        { status: 400 }
      )
    }

    const { portId, enabled } = body

    // Verify the port belongs to a tunnel owned by this user
    const port = await prisma.tunnelPort.findFirst({
      where: {
        id: portId,
        tunnel: {
          routerId,
          router: { userId: session.user.id },
        },
      },
      include: {
        tunnel: {
          include: { ports: true },
        },
      },
    })

    if (!port) {
      return Response.json({ error: "Port not found" }, { status: 404 })
    }

    // The 'api' port must remain enabled — it is the MCP communication channel
    if (port.serviceName === "api" && !enabled) {
      return Response.json(
        { error: "The 'api' port (8728) cannot be disabled — it is required for the AI agent to communicate with your router" },
        { status: 422 }
      )
    }

    // Free tier can only enable the API port — other ports require Pro or Premium
    if (enabled && port.serviceName !== "api") {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: session.user.id },
        select: { plan: true },
      })
      const plan = (subscription?.plan ?? "FREE") as PlanKey
      const { allowedTunnelPorts } = PLAN_LIMITS[plan]
      if (!allowedTunnelPorts.includes(port.serviceName)) {
        return Response.json(
          {
            error: "upgrade_required",
            message: `Port '${port.serviceName}' hanya tersedia untuk plan Pro atau Premium. Upgrade plan Anda untuk mengaktifkan port ini.`,
          },
          { status: 403 }
        )
      }
    }

    // Enforce a maximum of 5 enabled ports across the tunnel
    if (enabled) {
      const currentlyEnabled = port.tunnel.ports.filter(
        (p) => p.enabled && p.id !== portId
      ).length

      if (currentlyEnabled >= 5) {
        return Response.json(
          { error: "Maximum of 5 ports can be enabled per tunnel" },
          { status: 422 }
        )
      }
    }

    const updated = await prisma.tunnelPort.update({
      where: { id: portId },
      data: { enabled },
    })

    return Response.json(updated)
  } catch (error) {
    console.error("Failed to update tunnel port:", error)
    return Response.json(
      { error: "Failed to update tunnel port" },
      { status: 500 }
    )
  }
}
