import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  encryptBotToken,
  decryptBotToken,
  tgGetMe,
} from "@/lib/services/router-bot.service"

async function resolveRouter(userId: string, routerId: string | null) {
  if (!routerId) return null
  return prisma.router.findFirst({
    where: { id: routerId, userId },
    select: { id: true, name: true, botToken: true, botUsername: true, telegramOwnerUsername: true, telegramOwnerId: true },
  })
}

// GET /api/resellers/bot?routerId=X — returns current bot config (decrypted)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const router = await resolveRouter(session.user.id, routerId)
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  const token = router.botToken ? await decryptBotToken(router.botToken) : ""
  return Response.json({
    routerId: router.id,
    routerName: router.name,
    token,
    hasToken: !!router.botToken,
    botUsername: router.botUsername || "",
    telegramOwnerUsername: router.telegramOwnerUsername || "",
    telegramOwnerId: router.telegramOwnerId || "",
    active: !!router.botToken,
  })
}

// POST /api/resellers/bot?routerId=X — set/update bot token (encrypts + verifies via getMe)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const router = await resolveRouter(session.user.id, routerId)
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  const body = (await request.json()) as { token?: string; telegramOwnerId?: string; telegramOwnerUsername?: string }
  const token = (body.token ?? "").trim()
  if (!token) return Response.json({ error: "token required" }, { status: 400 })

  // Verify token via getMe before saving
  const botInfo = await tgGetMe(token)
  if (!botInfo) {
    return Response.json({ error: "Token invalid — Telegram getMe gagal. Cek token bot." }, { status: 400 })
  }

  const encrypted = await encryptBotToken(token)
  await prisma.router.update({
    where: { id: router.id },
    data: {
      botToken: encrypted,
      botUsername: botInfo.username || "",
      ...(body.telegramOwnerId !== undefined ? { telegramOwnerId: body.telegramOwnerId.trim() } : {}),
      ...(body.telegramOwnerUsername !== undefined ? { telegramOwnerUsername: body.telegramOwnerUsername.trim() } : {}),
    },
  })

  return Response.json({
    success: true,
    bot: {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
    },
  })
}

// DELETE /api/resellers/bot?routerId=X — clear bot token (deactivate)
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const router = await resolveRouter(session.user.id, routerId)
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  await prisma.router.update({
    where: { id: router.id },
    data: { botToken: "", botUsername: "" },
  })

  return Response.json({ success: true })
}
