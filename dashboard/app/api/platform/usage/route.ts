import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const tenants = await prisma.tenant.findMany({
    where: { status: { notIn: ["CHURNED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, routers: true } },
      subscription: { select: { plan: true, tokenLimit: true, tokensUsed: true } },
    },
  })

  // Token usage per tenant (current month)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const tokenUsages = await prisma.tokenUsage.groupBy({
    by: ["tenantId"],
    where: { timestamp: { gte: monthStart } },
    _sum: { tokensIn: true, tokensOut: true },
  })
  const tokenMap = Object.fromEntries(
    tokenUsages.map((t) => [t.tenantId, { tokensIn: t._sum.tokensIn ?? 0, tokensOut: t._sum.tokensOut ?? 0 }])
  )

  const result = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    userCount: t._count.users,
    routerCount: t._count.routers,
    subscription: t.subscription,
    monthlyTokens: tokenMap[t.id] ?? { tokensIn: 0, tokensOut: 0 },
  }))

  return Response.json(result)
}
