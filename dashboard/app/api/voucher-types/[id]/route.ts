import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const body = await request.json()
    const vt = await prisma.voucherType.update({
      where: { id, userId: session.user.id },
      data: {
        namaVoucher: body.namaVoucher,
        deskripsi: body.deskripsi ?? "",
        harga: Number(body.harga) || 0,
        markUp: Number(body.markUp) || 0,
        server: body.server ?? "all",
        profile: body.profile ?? "",
        limitUptime: body.limitUptime ?? "0",
        limitQuotaDl: Number(body.limitQuotaDl) || 0,
        limitQuotaUl: Number(body.limitQuotaUl) || 0,
        limitQuotaTotal: Number(body.limitQuotaTotal) || 0,
        typeChar: body.typeChar ?? "Random abcd",
        typeLogin: body.typeLogin ?? "Username & Password",
        prefix: body.prefix ?? "",
        panjangKarakter: Number(body.panjangKarakter) || 6,
        voucherGroup: body.voucherGroup ?? "default",
        voucherColor: body.voucherColor ?? "#ffffff",
      },
    })
    return Response.json(vt)
  } catch (e) {
    console.error(e)
    return Response.json({ error: "Failed to update voucher type" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    await prisma.voucherType.delete({ where: { id, userId: session.user.id } })
    return Response.json({ ok: true })
  } catch (e) {
    console.error(e)
    return Response.json({ error: "Failed to delete voucher type" }, { status: 500 })
  }
}
