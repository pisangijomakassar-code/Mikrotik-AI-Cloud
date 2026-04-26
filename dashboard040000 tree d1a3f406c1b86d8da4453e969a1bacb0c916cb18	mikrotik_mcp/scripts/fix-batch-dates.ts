import { prisma } from "@/lib/db"

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function parseSource(source: string): Date | null {
  // source format: "mikhmon_import:oct2025" → 2025-10-15
  const m = source.match(/mikhmon_import:([a-z]{3})(\d{4})/i)
  if (!m) return null
  const monthIdx = MONTH_MAP[m[1].toLowerCase()]
  const year = parseInt(m[2])
  if (monthIdx === undefined) return null
  return new Date(Date.UTC(year, monthIdx, 15, 12, 0, 0))
}

async function main() {
  const batches = await prisma.voucherBatch.findMany({
    where: { source: { startsWith: "mikhmon_import:" } },
    select: { id: true, source: true, createdAt: true },
  })

  console.log(`Found ${batches.length} mikhmon batches`)

  let updated = 0
  for (const b of batches) {
    const newDate = parseSource(b.source)
    if (!newDate) {
      console.log(`  SKIP ${b.source} - cannot parse`)
      continue
    }
    await prisma.voucherBatch.update({
      where: { id: b.id },
      data: { createdAt: newDate },
    })
    updated++
  }

  console.log(`\n✓ Updated ${updated} batches`)

  // Verify by month
  const byMonth = await prisma.$queryRaw<Array<{month: string, batches: bigint, vouchers: bigint, revenue: bigint}>>`
    SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*)::int as batches, SUM("count")::int as vouchers, SUM("totalCost")::bigint as revenue
    FROM "VoucherBatch"
    WHERE "source" LIKE 'mikhmon_import:%'
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
    ORDER BY month
  `
  console.log("\nResult by month:")
  byMonth.forEach(r => console.log(`  ${r.month}: ${r.batches} batches, ${r.vouchers} vouchers, Rp ${r.revenue}`))

  await prisma.$disconnect()
}
main().catch(console.error)
