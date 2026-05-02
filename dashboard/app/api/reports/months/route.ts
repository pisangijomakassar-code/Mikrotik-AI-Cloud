import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const batches = await prisma.voucherBatch.findMany({
    where: {
      tenantId: session.user.tenantId,
      source: { startsWith: "mikhmon_import" },
    },
    select: { source: true, count: true, totalCost: true },
  })

  // Group by month from source field (format: mikhmon_import:YYYY-MM)
  const monthMap: Record<string, { vouchers: number; revenue: number }> = {}
  for (const b of batches) {
    const month = b.source.split(":")[1] ?? "unknown"
    if (!monthMap[month]) monthMap[month] = { vouchers: 0, revenue: 0 }
    monthMap[month].vouchers += b.count
    monthMap[month].revenue += b.totalCost
  }

  const months = Object.entries(monthMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, stats]) => ({ month, ...stats }))

  return Response.json({ months })
}
