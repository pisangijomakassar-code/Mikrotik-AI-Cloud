import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id as string
  const tenantId = (session.user as { tenantId?: string }).tenantId

  // SUPER_ADMIN has no tenant — return defaults immediately
  if (session.user.role === "SUPER_ADMIN") {
    return Response.json({
      subscription: { plan: "FREE", status: "ACTIVE", tokenLimit: 0, tokensUsed: 0, billingCycleStart: new Date(), billingCycleEnd: null },
      usage: { totalIn: 0, totalOut: 0, totalRequests: 0 },
      dailyUsage: [],
      invoices: [],
    })
  }

  // Get subscription (or return defaults for FREE plan)
  // Subscription is tenant-scoped — use tenantId, not userId
  const subscription = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      plan: string
      status: string
      tokenLimit: number
      tokensUsed: number
      billingCycleStart: Date
      billingCycleEnd: Date | null
    }>
  >(
    `SELECT id, plan, status, "tokenLimit", "tokensUsed", "billingCycleStart", "billingCycleEnd"
     FROM "Subscription" WHERE "tenantId" = $1 LIMIT 1`,
    tenantId
  ).then((rows) => rows[0] ?? null)
    .catch(() => null)

  // Get today's token usage (aligns with daily enforcement)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const tokenUsage = await prisma.$queryRawUnsafe<
    Array<{
      totalIn: bigint
      totalOut: bigint
      count: bigint
    }>
  >(
    `SELECT COALESCE(SUM("tokensIn"), 0) as "totalIn",
            COALESCE(SUM("tokensOut"), 0) as "totalOut",
            COUNT(*) as count
     FROM "TokenUsage" WHERE "userId" = $1 AND timestamp >= $2`,
    userId,
    todayStart
  ).then((rows) => rows[0] ?? null)
    .catch(() => null)

  // Get recent invoices
  const invoices = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      number: string
      status: string
      amount: number
      currency: string
      periodStart: Date
      periodEnd: Date
      tokensUsed: number
      paidAt: Date | null
      createdAt: Date
    }>
  >(
    `SELECT id, number, status, amount, currency, "periodStart", "periodEnd", "tokensUsed", "paidAt", "createdAt"
     FROM "Invoice" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 12`,
    tenantId
  ).catch(() => [])

  // Daily usage breakdown (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const dailyUsage = await prisma.$queryRawUnsafe<
    Array<{
      date: string
      totalIn: bigint
      totalOut: bigint
      count: bigint
    }>
  >(
    `SELECT DATE(timestamp) as date,
            COALESCE(SUM("tokensIn"), 0) as "totalIn",
            COALESCE(SUM("tokensOut"), 0) as "totalOut",
            COUNT(*) as count
     FROM "TokenUsage" WHERE "userId" = $1 AND timestamp >= $2
     GROUP BY DATE(timestamp) ORDER BY date DESC`,
    userId,
    sevenDaysAgo
  ).catch(() => [])

  return Response.json({
    subscription: subscription ?? {
      plan: "FREE",
      status: "ACTIVE",
      tokenLimit: 100,
      tokensUsed: 0,
      billingCycleStart: new Date(),
      billingCycleEnd: null,
    },
    usage: {
      totalIn: Number(tokenUsage?.totalIn ?? 0),
      totalOut: Number(tokenUsage?.totalOut ?? 0),
      totalRequests: Number(tokenUsage?.count ?? 0),
    },
    dailyUsage: dailyUsage.map((d) => ({
      date: d.date,
      totalIn: Number(d.totalIn),
      totalOut: Number(d.totalOut),
      count: Number(d.count),
    })),
    invoices,
  })
}
