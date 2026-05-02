import { type NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { computeSignature } from "@/lib/midtrans"

// tokenLimit per plan (-1 = unlimited)
const PLAN_TOKEN_LIMIT: Record<string, number> = {
  FREE: 100,
  PRO: 1000,
  PREMIUM: -1,
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    order_id,
    transaction_status,
    status_code,
    gross_amount,
    signature_key,
    fraud_status,
  } = body

  // Verifikasi signature Midtrans
  const expected = computeSignature(order_id, status_code, gross_amount)
  if (expected !== signature_key) {
    console.error("Midtrans webhook: invalid signature", { order_id })
    return Response.json({ error: "Invalid signature" }, { status: 403 })
  }

  // Hanya proses order kita (prefix MTAI-)
  if (!order_id?.startsWith("MTAI-")) {
    return Response.json({ ok: true })
  }

  const isSuccess =
    transaction_status === "settlement" ||
    (transaction_status === "capture" && fraud_status === "accept")

  const isFailed =
    transaction_status === "cancel" ||
    transaction_status === "expire" ||
    transaction_status === "deny"

  if (isFailed) {
    await prisma.invoice.updateMany({
      where: { externalId: order_id },
      data: { status: "CANCELED" },
    })
    return Response.json({ ok: true })
  }

  if (!isSuccess) return Response.json({ ok: true })

  const invoice = await prisma.invoice.findUnique({
    where: { externalId: order_id },
  })
  if (!invoice) {
    console.error("Midtrans webhook: invoice not found", order_id)
    return Response.json({ error: "Invoice not found" }, { status: 404 })
  }

  // Idempotent — abaikan jika sudah PAID
  if (invoice.status === "PAID") return Response.json({ ok: true })

  // Parse plan dari orderId: MTAI-{PLAN}-{timestamp}
  const planPart = order_id.split("-")[1] as string // "PRO" | "PREMIUM"
  const plan = PLAN_TOKEN_LIMIT[planPart] !== undefined ? planPart : "FREE"
  const tokenLimit = PLAN_TOKEN_LIMIT[plan]

  const now = new Date()
  const cycleEnd = new Date(now)
  cycleEnd.setDate(cycleEnd.getDate() + 30)

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: now },
    }),
    prisma.subscription.upsert({
      where: { tenantId: invoice.tenantId },
      create: {
        plan: plan as "FREE" | "PRO" | "PREMIUM",
        status: "ACTIVE",
        tokenLimit,
        tokensUsed: 0,
        billingCycleStart: now,
        billingCycleEnd: cycleEnd,
        tenantId: invoice.tenantId,
      },
      update: {
        plan: plan as "FREE" | "PRO" | "PREMIUM",
        status: "ACTIVE",
        tokenLimit,
        billingCycleStart: now,
        billingCycleEnd: cycleEnd,
      },
    }),
  ])

  console.log(`Payment settled: tenant=${invoice.tenantId} plan=${plan} order=${order_id}`)
  return Response.json({ ok: true })
}
