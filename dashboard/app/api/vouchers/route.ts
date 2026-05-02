import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { listVoucherBatches } from "@/lib/services/reseller.service"
import type { VoucherFilter } from "@/lib/types"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams

    const filter: VoucherFilter = {}
    const source = searchParams.get("source")
    const resellerId = searchParams.get("resellerId")
    const page = searchParams.get("page")
    const pageSize = searchParams.get("pageSize")

    if (source) filter.source = source
    if (resellerId) filter.resellerId = resellerId
    if (page) filter.page = parseInt(page, 10)
    if (pageSize) filter.pageSize = parseInt(pageSize, 10)

    const data = await listVoucherBatches(filter)
    return Response.json(data)
  } catch (error) {
    console.error("Failed to fetch voucher batches:", error)
    return Response.json(
      { error: "Failed to fetch voucher batches" },
      { status: 500 }
    )
  }
}

// POST /api/vouchers
// Generate a voucher batch directly (admin/user, not reseller flow).
// Proxies to health_server which creates users on router + saves to VoucherBatch.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { profile, count, prefix, routerName, passwordLength, usernameLength, server, typeChar, typeLogin, limitUptime, limitQuota, resellerId, pricePerUnit, discount, markUp, comment } = body

    if (!profile || !count) {
      return Response.json({ error: "profile and count are required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true },
    })

    if (!user?.telegramId) {
      return Response.json({ error: "User has no Telegram ID configured" }, { status: 400 })
    }

    const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
    const agentRes = await fetch(`${agentUrl}/generate-vouchers/${user.telegramId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        count,
        prefix: prefix ?? "",
        router_name: routerName ?? "",
        password_length: passwordLength ?? 6,
        username_length: usernameLength ?? 6,
        server: server ?? "",
        typeChar: typeChar ?? "Random abcd2345",
        typeLogin: typeLogin ?? "Username = Password",
        limitUptime: limitUptime ?? "",
        limitQuota: limitQuota ?? 0,
        resellerId: resellerId ?? null,
        price_per_unit: pricePerUnit ?? 0,
        discount: discount ?? 0,
        markUp: markUp ?? 0,
        comment: comment ?? "",
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!agentRes.ok) {
      const errorText = await agentRes.text().catch(() => "Unknown error")
      return Response.json({ error: `Voucher generation failed: ${errorText}` }, { status: 502 })
    }

    const result = await agentRes.json()
    return Response.json(result, { status: 201 })
  } catch (error) {
    console.error("Failed to generate vouchers:", error)
    return Response.json({ error: "Failed to generate vouchers" }, { status: 500 })
  }
}
