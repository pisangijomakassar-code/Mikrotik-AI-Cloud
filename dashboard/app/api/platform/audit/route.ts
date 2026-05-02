import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(request.url)
  const tenantId = url.searchParams.get("tenantId") ?? undefined
  const status = url.searchParams.get("status") ?? undefined
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))
  const pageSize = 50

  const where: Record<string, unknown> = {}
  if (tenantId) where.tenantId = tenantId
  if (status) where.status = status

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, name: true } },
        router: { select: { name: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ])

  // Attach tenant name via tenantId lookup
  const tenantIds = [...new Set(logs.map((l) => l.tenantId))]
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true, slug: true },
  })
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]))

  const enriched = logs.map((l) => ({
    ...l,
    tenant: tenantMap[l.tenantId] ?? null,
  }))

  return Response.json({ logs: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
