import { prisma } from "../db"
import type { LogFilter, PaginatedResult } from "../types"

interface ActivityLogWithRelations {
  id: string
  timestamp: Date
  action: string
  tool: string | null
  status: string
  durationMs: number | null
  details: string | null
  errorMsg: string | null
  userId: string
  routerId: string | null
  user: { name: string }
  router: { name: string } | null
}

export async function getLogs(
  filter?: LogFilter
): Promise<PaginatedResult<ActivityLogWithRelations>> {
  const page = filter?.page ?? 1
  const pageSize = filter?.pageSize ?? 25
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}

  if (filter?.userId) {
    where.userId = filter.userId
  }
  if (filter?.action) {
    where.action = { contains: filter.action, mode: "insensitive" }
  }
  if (filter?.status) {
    where.status = filter.status
  }
  if (filter?.from || filter?.to) {
    where.timestamp = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    }
  }

  const [data, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { name: true } },
        router: { select: { name: true } },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
  ])

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
