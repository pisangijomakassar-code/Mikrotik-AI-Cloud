import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const KEY = "settings.telegram"

const DEFAULT = {
  botToken: "", botUsername: "", adminChatId: "",
  notifyOnNewTenant: true, notifyOnExpiry: true, notifyOnError: false,
}

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } })
  if (!row) return Response.json(DEFAULT)
  try {
    const val = JSON.parse(row.value)
    return Response.json({
      ...val,
      botToken: val.botToken ? "••••••••" : "",
      _hasBotToken: !!val.botToken,
    })
  } catch {
    return Response.json(DEFAULT)
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  let existing: Record<string, unknown> = { ...DEFAULT }
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } })
  if (row) { try { existing = JSON.parse(row.value) } catch {} }

  const value = JSON.stringify({
    botToken: body.botToken && body.botToken !== "••••••••" ? body.botToken : existing.botToken,
    botUsername: body.botUsername ?? existing.botUsername,
    adminChatId: body.adminChatId ?? existing.adminChatId,
    notifyOnNewTenant: body.notifyOnNewTenant ?? existing.notifyOnNewTenant,
    notifyOnExpiry: body.notifyOnExpiry ?? existing.notifyOnExpiry,
    notifyOnError: body.notifyOnError ?? existing.notifyOnError,
  })

  await prisma.systemSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } })
  return Response.json({ ok: true })
}
