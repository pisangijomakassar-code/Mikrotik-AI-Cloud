import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  listVoucherBatches,
  topDownSaldo,
} from "@/lib/services/reseller.service"
import type { GenerateVouchersInput } from "@/lib/types"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const data = await listVoucherBatches({ resellerId: id })
    return Response.json(data)
  } catch (error) {
    console.error("Failed to fetch voucher batches:", error)
    return Response.json(
      { error: "Failed to fetch voucher batches" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = (await request.json()) as GenerateVouchersInput

    if (!body.routerName || !body.profile || !body.count || !body.pricePerUnit) {
      return Response.json(
        { error: "routerName, profile, count, and pricePerUnit are required" },
        { status: 400 }
      )
    }

    const totalCost = body.count * body.pricePerUnit

    // Step 1: Deduct saldo
    try {
      await topDownSaldo(id, {
        amount: totalCost,
        description: `Voucher purchase: ${body.count}x ${body.profile} @ Rp ${body.pricePerUnit.toLocaleString("id-ID")}`,
      })
    } catch (deductError: unknown) {
      const message =
        deductError instanceof Error
          ? deductError.message
          : "Failed to deduct saldo"
      return Response.json({ error: message }, { status: 400 })
    }

    // Step 2: Get user's telegramId for health_server proxy
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true },
    })

    if (!user?.telegramId) {
      return Response.json(
        { error: "User has no Telegram ID configured" },
        { status: 400 }
      )
    }

    // Step 3: Proxy to health_server to generate vouchers on router
    const agentUrl =
      process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

    const agentRes = await fetch(
      `${agentUrl}/generate-vouchers/${user.telegramId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          router_name: body.routerName,
          profile: body.profile,
          count: body.count,
          prefix: body.prefix,
          password_length: body.passwordLength,
          username_length: body.usernameLength,
          char_type: body.charType,
          login_type: body.loginType,
          limit_uptime: body.limitUptime,
          limit_bytes_total: body.limitBytesTotal,
          server: body.server,
          reseller_id: id,
          price_per_unit: body.pricePerUnit,
        }),
        signal: AbortSignal.timeout(30000),
      }
    )

    if (!agentRes.ok) {
      const errorText = await agentRes.text().catch(() => "Unknown error")
      console.error("Agent voucher generation failed:", errorText)
      return Response.json(
        { error: `Voucher generation failed: ${errorText}` },
        { status: 502 }
      )
    }

    const result = await agentRes.json()
    return Response.json(result, { status: 201 })
  } catch (error) {
    console.error("Failed to generate vouchers:", error)
    return Response.json(
      { error: "Failed to generate vouchers" },
      { status: 500 }
    )
  }
}
