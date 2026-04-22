import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.voucherProfileSetting.findMany({
    where: { userId: session.user.id },
    orderBy: { profileName: "asc" },
  })

  return Response.json(settings)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { profileName, price, charType, charLength, loginType, limitUptime, limitQuota, qrColor } = body

  if (!profileName) {
    return Response.json({ error: "profileName is required" }, { status: 400 })
  }

  const setting = await prisma.voucherProfileSetting.upsert({
    where: { userId_profileName: { userId: session.user.id, profileName } },
    create: {
      userId: session.user.id,
      profileName,
      price: price ?? 0,
      charType: charType ?? "alphanumeric",
      charLength: charLength ?? 6,
      loginType: loginType ?? "separate",
      limitUptime: limitUptime || null,
      limitQuota: limitQuota || null,
      qrColor: qrColor ?? "#000000",
    },
    update: {
      price: price ?? 0,
      charType: charType ?? "alphanumeric",
      charLength: charLength ?? 6,
      loginType: loginType ?? "separate",
      limitUptime: limitUptime || null,
      limitQuota: limitQuota || null,
      qrColor: qrColor ?? "#000000",
    },
  })

  return Response.json(setting)
}
