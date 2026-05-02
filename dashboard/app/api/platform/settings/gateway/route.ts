import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const KEY = "settings.gateway"

const DEFAULT = {
  smtpHost: "", smtpPort: 587, smtpUser: "", smtpPass: "", smtpFrom: "", smtpSecure: false,
  smsProvider: "none", smsApiKey: "", smsFrom: "",
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
      smtpPass: val.smtpPass ? "••••••••" : "",
      smsApiKey: val.smsApiKey ? "••••••••" : "",
      _hasSmtpPass: !!val.smtpPass,
      _hasSmsKey: !!val.smsApiKey,
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
    smtpHost: body.smtpHost ?? existing.smtpHost,
    smtpPort: body.smtpPort ?? existing.smtpPort,
    smtpUser: body.smtpUser ?? existing.smtpUser,
    smtpPass: body.smtpPass && body.smtpPass !== "••••••••" ? body.smtpPass : existing.smtpPass,
    smtpFrom: body.smtpFrom ?? existing.smtpFrom,
    smtpSecure: body.smtpSecure ?? existing.smtpSecure,
    smsProvider: body.smsProvider ?? existing.smsProvider,
    smsApiKey: body.smsApiKey && body.smsApiKey !== "••••••••" ? body.smsApiKey : existing.smsApiKey,
    smsFrom: body.smsFrom ?? existing.smsFrom,
  })

  await prisma.systemSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } })
  return Response.json({ ok: true })
}
