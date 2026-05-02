import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const { searchParams } = request.nextUrl
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const resellerIdFilter = searchParams.get("resellerId")
  const routerFilter = searchParams.get("router")

  const dateFilter = from && to
    ? { gte: new Date(from), lte: new Date(to + "T23:59:59.999Z") }
    : undefined

  // Resolve routerName -> routerId untuk filter Reseller (yang scope-nya routerId)
  const routerRow = routerFilter
    ? await prisma.router.findFirst({
        where: { tenantId, name: routerFilter },
        select: { id: true },
      })
    : null
  const routerId = routerRow?.id ?? null

  const [batches, transactions, resellers] = await Promise.all([
    prisma.voucherBatch.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(resellerIdFilter ? { resellerId: resellerIdFilter } : {}),
        ...(routerFilter ? { routerName: routerFilter } : {}),
      },
      select: {
        id: true,
        routerName: true,
        profile: true,
        count: true,
        pricePerUnit: true,
        totalCost: true,
        source: true,
        createdAt: true,
        resellerId: true,
        reseller: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.saldoTransaction.findMany({
      where: {
        reseller: {
          tenantId,
          ...(routerId ? { routerId } : {}),
        },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(resellerIdFilter ? { resellerId: resellerIdFilter } : {}),
      },
      select: {
        id: true,
        type: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
        reseller: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.reseller.findMany({
      where: {
        tenantId,
        ...(routerId ? { routerId } : {}),
      },
      select: { id: true, name: true, balance: true, status: true },
    }),
  ])

  const totalVouchers = batches.reduce((s, b) => s + b.count, 0)
  const totalRevenue = batches.reduce((s, b) => s + b.totalCost, 0)
  const totalTopUp = transactions
    .filter((t) => t.type === "TOP_UP")
    .reduce((s, t) => s + t.amount, 0)
  const totalTopDown = transactions
    .filter((t) => t.type === "TOP_DOWN")
    .reduce((s, t) => s + t.amount, 0)

  // Breakdown — Generated (dashboard) vs Activated (mikhmon_import sync).
  // Each activation creates a separate VoucherBatch with source="mikhmon_import:YYYY-MM"
  // when synced from /system script. Generated batches use source="dashboard".
  const isActivation = (s: string) => s.startsWith("mikhmon_import")
  const generatedBatches = batches.filter((b) => !isActivation(b.source))
  const activatedBatches = batches.filter((b) => isActivation(b.source))
  const totalGenerated = generatedBatches.reduce((s, b) => s + b.count, 0)
  const totalActivated = activatedBatches.reduce((s, b) => s + b.count, 0)
  const totalUnused = Math.max(0, totalGenerated - totalActivated)
  const generatedRevenue = generatedBatches.reduce((s, b) => s + b.totalCost, 0)
  const activatedRevenue = activatedBatches.reduce((s, b) => s + b.totalCost, 0)
  const activationRate = totalGenerated > 0
    ? Math.min(100, Math.round((totalActivated / totalGenerated) * 100))
    : null

  return Response.json({
    summary: {
      totalVouchers, totalRevenue, totalTopUp, totalTopDown,
      totalResellers: resellers.length,
      // New breakdown:
      totalGenerated, totalActivated, totalUnused,
      generatedRevenue, activatedRevenue,
      activationRate,
    },
    batches,
    transactions,
    resellers,
  })
}
