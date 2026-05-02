import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") ?? ""
    const page = parseInt(searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(searchParams.get("pageSize") ?? "30", 10)

    // SaldoTransaction tidak punya tenantId langsung di skema (cascade dari
    // Reseller); filter via reseller relation.
    const where: Record<string, unknown> = {
      reseller: { tenantId: session.user.tenantId },
    }

    if (search) {
      where.OR = [
        { reseller: { name: { contains: search, mode: "insensitive" } } },
        { description: { contains: search, mode: "insensitive" } },
        { voucherUsername: { contains: search, mode: "insensitive" } },
        { voucherInfo: { contains: search, mode: "insensitive" } },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.saldoTransaction.findMany({
        where,
        include: {
          reseller: { select: { id: true, name: true, telegramId: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.saldoTransaction.count({ where }),
    ])

    return Response.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Failed to fetch transaction history:", error)
    return Response.json({ error: "Failed to fetch history" }, { status: 500 })
  }
}
