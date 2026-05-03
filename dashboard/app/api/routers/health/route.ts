import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/db-tenant"
import { AGENT_URL } from "@/lib/agent-fetch"

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
    const db = await getTenantDb()
    const dbRouters = await db.router.findMany({
      select: { id: true, name: true, telegramOwnerId: true },
    })

    if (!dbRouters.length) return Response.json([])

    // Group routers by their telegramOwnerId so we make one agent call per owner.
    const byOwner = new Map<string, typeof dbRouters>()
    const noOwner: typeof dbRouters = []
    for (const r of dbRouters) {
      if (r.telegramOwnerId) {
        const list = byOwner.get(r.telegramOwnerId) ?? []
        list.push(r)
        byOwner.set(r.telegramOwnerId, list)
      } else {
        noOwner.push(r)
      }
    }

    const results: RouterHealth[] = []

    for (const [tgId, routers] of byOwner) {
      try {
        const res = await fetch(`${AGENT_URL}/router-health/${tgId}`, {
          signal: AbortSignal.timeout(15000),
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

    // Routers with no telegramOwnerId configured — always offline until owner is set.
    for (const r of noOwner) results.push({ id: r.id, name: r.name, status: "offline" })

    return Response.json(results)
  } catch (error) {
    console.error("Health check failed:", error)
    return Response.json({ error: "Health check failed" }, { status: 500 })
  }
}
