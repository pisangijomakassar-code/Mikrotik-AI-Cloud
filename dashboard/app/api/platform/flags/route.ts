import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function guard() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}

const DEFAULT_FLAGS = [
  { key: "reseller_module", description: "Enable reseller & voucher reselling features" },
  { key: "ppp_module", description: "Enable PPP secrets management" },
  { key: "multi_router", description: "Allow tenants to add more than one router" },
  { key: "ai_chat", description: "Enable AI Assistant chat interface" },
  { key: "telegram_bot", description: "Enable Telegram bot integration" },
  { key: "traffic_snapshots", description: "Enable hourly bandwidth snapshots" },
  { key: "netwatch", description: "Enable Netwatch monitoring" },
]

export async function GET() {
  const err = await guard()
  if (err) return err

  // Upsert defaults so they always appear
  for (const f of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {},
      create: { key: f.key, description: f.description, enabled: true },
    })
  }

  const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } })
  return Response.json(flags)
}

export async function POST(request: Request) {
  const err = await guard()
  if (err) return err

  const { key, description, enabled = false } = await request.json()
  if (!key) return Response.json({ error: "key is required" }, { status: 400 })

  const flag = await prisma.featureFlag.upsert({
    where: { key },
    update: { description, enabled },
    create: { key, description: description ?? "", enabled },
  })
  return Response.json(flag, { status: 201 })
}
