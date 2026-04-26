import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const types = await prisma.voucherType.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })
  return Response.json(types)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const vt = await prisma.voucherType.create({
      data: {
        id: crypto.randomUUID(),
        userId: session.user.id,
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
        addressPool: body.addressPool ?? "",
      },
    })
    return Response.json(vt, { status: 201 })
  } catch (e) {
    console.error(e)
    return Response.json({ error: "Failed to create voucher type" }, { status: 500 })
  }
}
