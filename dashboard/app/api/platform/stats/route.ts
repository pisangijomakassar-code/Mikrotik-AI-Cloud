import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const [tenantCounts, recentTenants, totalRouters, totalUsers, expiringSoonCount] =
    await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.tenant.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { users: true, routers: true } } },
      }),
      prisma.router.count(),
      prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
      prisma.tenant.count({
        where: {
          expiresAt: { lte: thirtyDaysFromNow, gte: new Date() },
          status: { in: ["ACTIVE", "TRIAL"] },
        },
      }),
    ])

  const byStatus = Object.fromEntries(
    tenantCounts.map(({ status, _count }) => [status, _count.id])
  )
  const total = tenantCounts.reduce((s, { _count }) => s + _count.id, 0)

  return Response.json({
    tenants: {
      total,
      active: byStatus.ACTIVE ?? 0,
      trial: byStatus.TRIAL ?? 0,
      suspended: byStatus.SUSPENDED ?? 0,
      expired: byStatus.EXPIRED ?? 0,
      churned: byStatus.CHURNED ?? 0,
    },
    totalRouters,
    totalUsers,
    expiringSoonCount,
    recentTenants,
  })
}
