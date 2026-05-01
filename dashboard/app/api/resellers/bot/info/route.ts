import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  decryptBotToken,
  tgGetMe,
  tgGetWebhookInfo,
  tgSetWebhook,
  tgDeleteWebhook,
} from "@/lib/services/router-bot.service"

async function resolveRouterToken(userId: string, routerId: string | null) {
  if (!routerId) return null
  const router = await prisma.router.findFirst({
    where: { id: routerId, userId },
    select: { id: true, name: true, botToken: true, botUsername: true },
  })
  if (!router || !router.botToken) return null
  const token = await decryptBotToken(router.botToken)
  if (!token) return null
  return { router, token }
}

// GET /api/resellers/bot/info?routerId=X — combined getMe + getWebhookInfo
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const ctx = await resolveRouterToken(session.user.id, routerId)
  if (!ctx) return Response.json({ error: "Bot belum dikonfigurasi untuk router ini" }, { status: 404 })

  const [me, webhook] = await Promise.all([tgGetMe(ctx.token), tgGetWebhookInfo(ctx.token)])
  if (!me) {
    return Response.json({ error: "getMe gagal — token mungkin invalid atau Telegram unreachable" }, { status: 502 })
  }

  const hasWebhook = !!(webhook?.url && webhook.url.length > 0)
  return Response.json({
    routerId: ctx.router.id,
    routerName: ctx.router.name,
    bot: {
      id: me.id,
      username: me.username,
      firstName: me.first_name,
    },
    webhook: webhook ?? {},
    mode: hasWebhook ? "webhook" : "polling",
    active: true,
  })
}

// POST /api/resellers/bot/info?routerId=X  body: {url} — set webhook URL
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const ctx = await resolveRouterToken(session.user.id, routerId)
  if (!ctx) return Response.json({ error: "Bot belum dikonfigurasi" }, { status: 404 })

  const body = (await request.json()) as { url?: string }
  const url = (body.url ?? "").trim()
  if (!url) return Response.json({ error: "url required" }, { status: 400 })
  if (!url.startsWith("https://")) {
    return Response.json({ error: "URL harus HTTPS" }, { status: 400 })
  }

  const result = await tgSetWebhook(ctx.token, url)
  return Response.json(result, { status: result.ok ? 200 : 400 })
}

// DELETE /api/resellers/bot/info?routerId=X — unset webhook (back to polling)
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  const ctx = await resolveRouterToken(session.user.id, routerId)
  if (!ctx) return Response.json({ error: "Bot belum dikonfigurasi" }, { status: 404 })

  const result = await tgDeleteWebhook(ctx.token)
  return Response.json(result, { status: result.ok ? 200 : 400 })
}
