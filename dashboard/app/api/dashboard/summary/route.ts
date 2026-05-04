import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/dashboard/summary?router=<name>
// Returns all dashboard data in one shot:
//   - kpi: pendapatan/voucher hari ini, traffic hari ini, delta vs kemarin
//   - monthly: 12 bulan revenue + voucher + bandwidth
//   - today: recap (hourly traffic untuk peak hour, login/logout count)
//   - topProfile: top 5 profile bulan ini
//   - topReseller: top 5 reseller bulan ini
//
// Active session count + router status diambil terpisah dari quickstats agent
// (karena perlu query realtime ke RouterOS).
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const tenantId = session.user.tenantId
  const routerName = request.nextUrl.searchParams.get("router")

  // Resolve routerId dan wanInterface untuk filter reseller dan traffic
  const routerRow = routerName
    ? await prisma.router.findFirst({ where: { tenantId, name: routerName }, select: { id: true, wanInterface: true } })
    : null
  const routerId = routerRow?.id ?? null
  const wanInterface = routerRow?.wanInterface?.trim() || null

  // Boundaries pakai timezone WITA (UTC+8) supaya "hari ini" / "bulan ini"
  // sesuai persepsi user, bukan UTC.
  const WITA_OFFSET_MS = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const startToday = new Date(Math.floor((nowMs + WITA_OFFSET_MS) / 86400000) * 86400000 - WITA_OFFSET_MS)
  const startYesterday = new Date(startToday.getTime() - 86400000)
  // Awal bulan WITA: pakai date wita lalu balik ke UTC
  const witaNow = new Date(nowMs + WITA_OFFSET_MS)
  const startMonth = new Date(Date.UTC(witaNow.getUTCFullYear(), witaNow.getUTCMonth(), 1) - WITA_OFFSET_MS)
  const start12mo = new Date(Date.UTC(witaNow.getUTCFullYear(), witaNow.getUTCMonth() - 11, 1) - WITA_OFFSET_MS)

  const batchWhere = (gte: Date, lte?: Date) => ({
    tenantId,
    ...(routerName ? { routerName } : {}),
    createdAt: { gte, ...(lte ? { lte } : {}) },
  })

  const [todayBatches, yesterdayBatches, monthBatches, batches12mo, topProfileRows, topResellerRows] =
    await Promise.all([
      prisma.voucherBatch.findMany({
        where: batchWhere(startToday),
        select: { count: true, totalCost: true },
      }),
      prisma.voucherBatch.findMany({
        where: batchWhere(startYesterday, startToday),
        select: { count: true, totalCost: true },
      }),
      prisma.voucherBatch.findMany({
        where: batchWhere(startMonth),
        select: { count: true, totalCost: true, profile: true, resellerId: true },
      }),
      prisma.voucherBatch.findMany({
        where: batchWhere(start12mo),
        select: { count: true, totalCost: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.voucherBatch.groupBy({
        by: ["profile"],
        where: batchWhere(startMonth),
        _sum: { count: true, totalCost: true },
        orderBy: { _sum: { count: "desc" } },
        take: 5,
      }),
      prisma.voucherBatch.groupBy({
        by: ["resellerId"],
        where: { ...batchWhere(startMonth), resellerId: { not: null } },
        _sum: { count: true, totalCost: true },
        orderBy: { _sum: { totalCost: "desc" } },
        take: 5,
      }),
    ])

  // Reseller name lookup
  const resellerIds = topResellerRows.map((r) => r.resellerId).filter((x): x is string => !!x)
  const resellers = resellerIds.length
    ? await prisma.reseller.findMany({
        where: { id: { in: resellerIds }, tenantId, ...(routerId ? { routerId } : {}) },
        select: { id: true, name: true },
      })
    : []
  const resellerNameMap = new Map(resellers.map((r) => [r.id, r.name]))

  // Aggregate
  const sum = (arr: { count: number; totalCost: number }[]) => ({
    count: arr.reduce((s, b) => s + b.count, 0),
    revenue: arr.reduce((s, b) => s + b.totalCost, 0),
  })
  const today = sum(todayBatches)
  const yesterday = sum(yesterdayBatches)
  const month = sum(monthBatches)
  const delta = (curr: number, prev: number) =>
    prev === 0 ? null : Math.round(((curr - prev) / prev) * 100)

  // Monthly groupBy bulan — pakai timezone WITA (UTC+8) supaya batch yang
  // createdAt-nya 23:30 UTC = 07:30 WITA next day di-bucket di bulan WITA, bukan UTC.
  const monthlyMap = new Map<string, { vouchers: number; revenue: number }>()
  for (const b of batches12mo) {
    const witaMs = b.createdAt.getTime() + WITA_OFFSET_MS
    const wita = new Date(witaMs)
    const key = `${wita.getUTCFullYear()}-${String(wita.getUTCMonth() + 1).padStart(2, "0")}`
    const cur = monthlyMap.get(key) ?? { vouchers: 0, revenue: 0 }
    cur.vouchers += b.count
    cur.revenue += b.totalCost
    monthlyMap.set(key, cur)
  }
  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  // Bandwidth bulanan + hourly hari ini via raw SQL (LAG window function)
  // Jika wanInterface dikonfigurasi, hanya hitung interface itu (hindari double-count).
  // Jika kosong, fallback ke semua interface (kurang akurat tapi tetap tampil).
  const bandwidthMonthly = routerName
    ? await prisma.$queryRaw<{ month: string; gb: number }[]>`
        WITH ordered AS (
          SELECT "interfaceName", "takenAt", "txBytes", "rxBytes",
            LAG("txBytes") OVER (PARTITION BY "interfaceName" ORDER BY "takenAt") AS prev_tx,
            LAG("rxBytes") OVER (PARTITION BY "interfaceName" ORDER BY "takenAt") AS prev_rx
          FROM "TrafficSnapshot"
          WHERE "tenantId" = ${tenantId} AND "routerName" = ${routerName}
            AND "takenAt" >= ${start12mo}
            AND (${wanInterface}::text IS NULL OR "interfaceName" = ${wanInterface})
        ), deltas AS (
          SELECT "takenAt",
            GREATEST("txBytes" - prev_tx, 0) + GREATEST("rxBytes" - prev_rx, 0) AS bytes_delta
          FROM ordered WHERE prev_tx IS NOT NULL
        )
        SELECT to_char(("takenAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar'), 'YYYY-MM') AS month,
               ROUND(SUM(bytes_delta)::numeric / 1024 / 1024 / 1024, 2)::float AS gb
        FROM deltas GROUP BY month ORDER BY month
      `
    : []

  // Hourly traffic — convert UTC ke timezone WITA (Asia/Makassar) supaya
  // jam 09:00-11:00 muncul di kolom 09-11 (bukan 01-03 UTC).
  // Prisma DateTime → TIMESTAMP(3) WITHOUT tz (stored as UTC). Convert dgn
  // double AT TIME ZONE: pertama declare 'UTC' (jadi timestamptz), kedua shift ke WITA.
  const bandwidthHourly = routerName
    ? await prisma.$queryRaw<{ hour: number; gb: number }[]>`
        WITH ordered AS (
          SELECT "interfaceName", "takenAt", "txBytes", "rxBytes",
            LAG("txBytes") OVER (PARTITION BY "interfaceName" ORDER BY "takenAt") AS prev_tx,
            LAG("rxBytes") OVER (PARTITION BY "interfaceName" ORDER BY "takenAt") AS prev_rx
          FROM "TrafficSnapshot"
          WHERE "tenantId" = ${tenantId} AND "routerName" = ${routerName}
            AND "takenAt" >= ${startToday}
            AND (${wanInterface}::text IS NULL OR "interfaceName" = ${wanInterface})
        ), deltas AS (
          SELECT "takenAt",
            GREATEST("txBytes" - prev_tx, 0) + GREATEST("rxBytes" - prev_rx, 0) AS bytes_delta
          FROM ordered WHERE prev_tx IS NOT NULL
        )
        SELECT EXTRACT(HOUR FROM ("takenAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar'))::int AS hour,
               ROUND(SUM(bytes_delta)::numeric / 1024 / 1024 / 1024, 2)::float AS gb
        FROM deltas GROUP BY hour ORDER BY hour
      `
    : []

  const bwToday = bandwidthHourly.reduce((s, x) => s + (x.gb ?? 0), 0)
  const bwTodayGB = +bwToday.toFixed(2)
  const peakHour = bandwidthHourly.reduce(
    (best, x) => (x.gb > (best?.gb ?? -1) ? x : best),
    null as null | { hour: number; gb: number },
  )

  return Response.json({
    kpi: {
      revenueToday: today.revenue,
      vouchersToday: today.count,
      revenueDelta: delta(today.revenue, yesterday.revenue),
      vouchersDelta: delta(today.count, yesterday.count),
      bandwidthTodayGB: bwTodayGB,
      peakHour: peakHour ? { hour: peakHour.hour, gb: peakHour.gb } : null,
    },
    monthly,
    bandwidthMonthly,
    bandwidthHourly,
    summary: {
      monthRevenue: month.revenue,
      monthVouchers: month.count,
    },
    topProfile: topProfileRows.map((r) => ({
      profile: r.profile,
      count: r._sum.count ?? 0,
      revenue: r._sum.totalCost ?? 0,
    })),
    topReseller: topResellerRows.map((r) => ({
      resellerId: r.resellerId!,
      name: resellerNameMap.get(r.resellerId!) ?? "(unknown)",
      count: r._sum.count ?? 0,
      revenue: r._sum.totalCost ?? 0,
    })),
  })
}
