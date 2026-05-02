import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getTenantDb } from "@/lib/db-tenant"

interface RouterHealth {
  id: string
  name: string
  status: "online" | "offline"
  cpuLoad?: number
  memoryPercent?: number
  uptime?: string
  activeClients?: number
  version?: string
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get user's telegram ID to query agent health API (User adalah cross-tenant model
    // — pakai prisma raw, filter by id eksplisit).
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true },
    })

    if (!user?.telegramId) {
      return Response.json([])
    }

    // Get routers from DB — tenant-scoped via getTenantDb().
    const db = await getTenantDb()
    const dbRouters = await db.router.findMany({
      select: { id: true, name: true },
    })

    // Call agent's health API (runs on port 8080 inside mikrotik-agent container)
    const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

    try {
      const res = await fetch(`${agentUrl}/router-health/${user.telegramId}`, {
        signal: AbortSignal.timeout(15000),
      })

      if (res.ok) {
        const agentHealth = await res.json()

        // Map agent results to DB router IDs
        const results: RouterHealth[] = dbRouters.map((dbRouter) => {
          const health = agentHealth.find((h: { name: string }) => h.name === dbRouter.name)
          if (health && health.status === "online") {
            // Update lastSeen (tenant-scoped)
            db.router.update({
              where: { id: dbRouter.id },
              data: { lastSeen: new Date(), routerosVersion: health.version || undefined },
            }).catch(() => {})

            return {
              id: dbRouter.id,
              name: dbRouter.name,
              status: "online",
              cpuLoad: health.cpuLoad ?? 0,
              memoryPercent: health.memoryPercent ?? 0,
              uptime: health.uptime ?? "",
              activeClients: health.activeClients ?? 0,
              version: health.version ?? "",
            }
          }
          return { id: dbRouter.id, name: dbRouter.name, status: "offline" }
        })

        return Response.json(results)
      }
    } catch {
      // Agent health API not reachable — fallback to TCP check
    }

    // Fallback: return all as unknown
    return Response.json(
      dbRouters.map((r) => ({ id: r.id, name: r.name, status: "offline" as const }))
    )
  } catch (error) {
    console.error("Health check failed:", error)
    return Response.json({ error: "Health check failed" }, { status: 500 })
  }
}
