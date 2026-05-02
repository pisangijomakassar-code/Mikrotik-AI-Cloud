import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID" },
    select: { amount: true, currency: true, paidAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const byMonth: Record<string, number> = {}
  for (const inv of invoices) {
    const d = inv.paidAt ?? inv.createdAt
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    byMonth[key] = (byMonth[key] ?? 0) + inv.amount
  }

  const subs = await prisma.subscription.groupBy({
    by: ["plan"],
    _count: { id: true },
  })

  const totalRevenue = invoices.reduce((s, i) => s + i.amount, 0)
  const totalInvoices = await prisma.invoice.count()
  const paidCount = invoices.length
  const pendingCount = await prisma.invoice.count({ where: { status: "PENDING" } })
  const overdueCount = await prisma.invoice.count({ where: { status: "OVERDUE" } })

  return Response.json({
    totalRevenue,
    totalInvoices,
    paidCount,
    pendingCount,
    overdueCount,
    byMonth: Object.entries(byMonth).map(([month, amount]) => ({ month, amount })),
    planBreakdown: subs.map(s => ({ plan: s.plan, count: s._count.id })),
  })
}
