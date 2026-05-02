import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const KEY = "broadcast.maintenance"

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } })
  if (!row) return Response.json({ active: false, message: "", startsAt: null, endsAt: null })
  try {
    return Response.json(JSON.parse(row.value))
  } catch {
    return Response.json({ active: false, message: "", startsAt: null, endsAt: null })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const value = JSON.stringify({
    active: body.active ?? false,
    message: body.message ?? "",
    startsAt: body.startsAt ?? null,
    endsAt: body.endsAt ?? null,
  })
  const row = await prisma.systemSetting.upsert({
    where: { key: KEY },
    update: { value },
    create: { key: KEY, value },
  })
  return Response.json(JSON.parse(row.value))
}
