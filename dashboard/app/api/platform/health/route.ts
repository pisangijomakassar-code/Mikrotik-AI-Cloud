import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const start = Date.now()

  // DB health
  let dbOk = false
  let dbLatencyMs = 0
  try {
    await prisma.$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - start
    dbOk = true
  } catch {}

  // Platform counts
  const [tenantCount, routerCount, userCount, activeTenantsCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.router.count(),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
  ])

  // Agent health (optional — won't fail the endpoint if agent is down)
  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  let agentOk = false
  let agentLatencyMs: number | null = null
  try {
    const t = Date.now()
    const res = await fetch(`${agentUrl}/health`, { signal: AbortSignal.timeout(3000) })
    agentLatencyMs = Date.now() - t
    agentOk = res.ok
  } catch {}

  return Response.json({
    timestamp: new Date().toISOString(),
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    agent: { ok: agentOk, latencyMs: agentLatencyMs },
    platform: { tenantCount, routerCount, userCount, activeTenantsCount },
  })
}
