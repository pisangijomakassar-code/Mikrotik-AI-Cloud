import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/settings/llm/usage
// Returns: { today, month, last30days[] }
export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  // Boundaries WITA (UTC+8)
  const WITA = 8 * 60 * 60 * 1000
  const nowMs = Date.now()
  const startToday = new Date(Math.floor((nowMs + WITA) / 86400000) * 86400000 - WITA)
  const witaNow = new Date(nowMs + WITA)
  const startMonth = new Date(Date.UTC(witaNow.getUTCFullYear(), witaNow.getUTCMonth(), 1) - WITA)
  const start30d = new Date(nowMs - 30 * 86400000)

  // Admin lihat global, user biasa lihat dirinya saja
  const where = session.user.role === "ADMIN" ? {} : { userId }

  const [today, month, all30d] = await Promise.all([
    prisma.tokenUsage.aggregate({
      where: { ...where, timestamp: { gte: startToday } },
      _sum: { tokensIn: true, tokensOut: true },
      _count: true,
    }),
    prisma.tokenUsage.aggregate({
      where: { ...where, timestamp: { gte: startMonth } },
      _sum: { tokensIn: true, tokensOut: true },
      _count: true,
    }),
    prisma.tokenUsage.findMany({
      where: { ...where, timestamp: { gte: start30d } },
      select: { timestamp: true, tokensIn: true, tokensOut: true },
      orderBy: { timestamp: "asc" },
    }),
  ])

  // Group last30d by date (YYYY-MM-DD WITA)
  const dailyMap = new Map<string, { in: number; out: number; calls: number }>()
  for (const r of all30d) {
    const localDate = new Date(r.timestamp.getTime() + WITA).toISOString().slice(0, 10)
    const cur = dailyMap.get(localDate) ?? { in: 0, out: 0, calls: 0 }
    cur.in += r.tokensIn
    cur.out += r.tokensOut
    cur.calls += 1
    dailyMap.set(localDate, cur)
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v, total: v.in + v.out }))

  return Response.json({
    today: {
      tokensIn: today._sum.tokensIn ?? 0,
      tokensOut: today._sum.tokensOut ?? 0,
      total: (today._sum.tokensIn ?? 0) + (today._sum.tokensOut ?? 0),
      calls: today._count,
    },
    month: {
      tokensIn: month._sum.tokensIn ?? 0,
      tokensOut: month._sum.tokensOut ?? 0,
      total: (month._sum.tokensIn ?? 0) + (month._sum.tokensOut ?? 0),
      calls: month._count,
    },
    daily,
    isGlobal: session.user.role === "ADMIN",
  })
}
