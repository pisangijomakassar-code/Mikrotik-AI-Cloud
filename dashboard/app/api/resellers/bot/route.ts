import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/db-tenant"
import { agentFetch } from "@/lib/agent-fetch"
import {
  encryptBotToken,
  decryptBotToken,
  tgGetMe,
} from "@/lib/services/router-bot.service"

async function triggerBotRestart(routerId: string): Promise<{ ok: boolean; status?: string; message?: string }> {
  try {
    const res = await agentFetch(`/reseller-bot/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ router_id: routerId }),
      signal: AbortSignal.timeout(8000),
    })
    return (await res.json()) as { ok: boolean; status?: string; message?: string }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "agent unreachable" }
  }
}

async function resolveRouter(routerId: string | null) {
  if (!routerId) return null
  const db = await getTenantDb()
  return db.router.findFirst({
    where: { id: routerId },
    select: { id: true, name: true, botToken: true, botUsername: true, telegramOwnerUsername: true, telegramOwnerId: true },
  })
}

// GET /api/resellers/bot?routerId=X — returns current bot config (decrypted)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const router = await resolveRouter(routerId)
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
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL || "",
  })
}

// POST /api/resellers/bot?routerId=X — set/update bot token (encrypts + verifies via getMe)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const router = await resolveRouter(routerId)
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
  const dbT = await getTenantDb()
  await dbT.router.update({
    where: { id: router.id },
    data: {
      botToken: encrypted,
      botUsername: botInfo.username || "",
      ...(body.telegramOwnerId !== undefined ? { telegramOwnerId: body.telegramOwnerId.trim() } : {}),
      ...(body.telegramOwnerUsername !== undefined ? { telegramOwnerUsername: body.telegramOwnerUsername.trim() } : {}),
    },
  })

  const restart = await triggerBotRestart(router.id)
  return Response.json({
    success: true,
    bot: {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
    },
    restart,
  })
}

// DELETE /api/resellers/bot?routerId=X — clear bot token (deactivate)
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const router = await resolveRouter(routerId)
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  const dbT = await getTenantDb()
  await dbT.router.update({
    where: { id: router.id },
    data: { botToken: "", botUsername: "" },
  })

  const restart = await triggerBotRestart(router.id)
  return Response.json({ success: true, restart })
}
