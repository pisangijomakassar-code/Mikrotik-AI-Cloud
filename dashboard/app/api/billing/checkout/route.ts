import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/db-tenant"
import { createSnapToken, SNAP_SCRIPT_URL, MIDTRANS_CLIENT_KEY } from "@/lib/midtrans"
import { PLAN_LIMITS, type PlanKey } from "@/lib/constants/plan-limits"

// Harga dalam IDR (bukan cents) — ini yang dikirim ke Midtrans
const PLAN_PRICE_IDR: Record<string, number> = {
  PRO: 99000,
  PREMIUM: 199000,
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const tenantId = (session.user as { tenantId?: string }).tenantId
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 })

  const { plan } = (await request.json()) as { plan: string }
  const priceIdr = PLAN_PRICE_IDR[plan]
  if (!priceIdr) return Response.json({ error: "Invalid plan" }, { status: 400 })

  const planInfo = PLAN_LIMITS[plan as PlanKey]
  // Format: MTAI-{PLAN}-{timestamp} — mudah di-parse webhook
  const orderId = `MTAI-${plan}-${Date.now()}`

  const db = await getTenantDb()
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  // Buat invoice PENDING dulu sebelum panggil Midtrans
  // tenantId di-inject otomatis oleh getTenantDb() extension
  const invoice = await db.invoice.create({
    data: {
      number: orderId,
      status: "PENDING",
      amount: priceIdr * 100, // simpan dalam cents
      currency: "IDR",
      periodStart: now,
      periodEnd,
      externalId: orderId,
      tenantId, // diperlukan TypeScript; runtime-nya di-override extension
    },
  })

  try {
    const snap = await createSnapToken({
      orderId,
      grossAmount: priceIdr,
      customerEmail: session.user.email ?? "",
      itemName: `MikroTik AI ${planInfo.label} — 30 hari`,
    })

    return Response.json({
      snapToken: snap.token,
      clientKey: MIDTRANS_CLIENT_KEY,
      snapUrl: SNAP_SCRIPT_URL,
      invoiceId: invoice.id,
    })
  } catch (err) {
    // Gagal buat token — batalkan invoice agar tidak zombie
    await db.invoice.delete({ where: { id: invoice.id } }).catch(() => {})
    console.error("Midtrans checkout error:", err)
    return Response.json({ error: "Payment gateway error" }, { status: 502 })
  }
}
