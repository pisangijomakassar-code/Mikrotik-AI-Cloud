import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/db-tenant"
import { AGENT_URL } from "@/lib/agent-fetch"
import { prisma } from "@/lib/db"

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
  if (session.user.role === "SUPER_ADMIN") return Response.json([])

  try {
    const sessionUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true, id: true },
    })
    const sessionUserId = sessionUser?.telegramId ?? sessionUser?.id ?? session.user.id

    const db = await getTenantDb()
    const dbRouters = await db.router.findMany({
      select: { id: true, name: true, telegramOwnerId: true },
    })

    if (!dbRouters.length) return Response.json([])

    // Group routers by telegramOwnerId; fall back to session user's identifier
    // for routers added via web (no telegramOwnerId set).
    const byOwner = new Map<string, typeof dbRouters>()
    for (const r of dbRouters) {
      const ownerId = r.telegramOwnerId || sessionUserId
      const list = byOwner.get(ownerId) ?? []
      list.push(r)
      byOwner.set(ownerId, list)
    }

    const results: RouterHealth[] = []

    for (const [tgId, routers] of byOwner) {
      try {
        const res = await fetch(`${AGENT_URL}/router-health/${tgId}`, {
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const agentHealth = await res.json() as Array<{ name: string; status: string; cpuLoad?: number; memoryPercent?: number; uptime?: string; activeClients?: number; version?: string }>
          for (const dbRouter of routers) {
            const h = agentHealth.find((a) => a.name === dbRouter.name)
            if (h?.status === "online") {
              db.router.update({
                where: { id: dbRouter.id },
                data: { lastSeen: new Date(), routerosVersion: h.version || undefined },
              }).catch(() => {})
              results.push({
                id: dbRouter.id, name: dbRouter.name, status: "online",
                cpuLoad: h.cpuLoad ?? 0, memoryPercent: h.memoryPercent ?? 0,
                uptime: h.uptime ?? "", activeClients: h.activeClients ?? 0,
                version: h.version ?? "",
              })
            } else {
              results.push({ id: dbRouter.id, name: dbRouter.name, status: "offline" })
            }
          }
        } else {
          for (const r of routers) results.push({ id: r.id, name: r.name, status: "offline" })
        }
      } catch {
        for (const r of routers) results.push({ id: r.id, name: r.name, status: "offline" })
      }
    }

    return Response.json(results)
  } catch (error) {
    console.error("Health check failed:", error)
    return Response.json({ error: "Health check failed" }, { status: 500 })
  }
}
