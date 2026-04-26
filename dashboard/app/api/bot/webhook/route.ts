import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function getBotToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { resellerBotToken: true },
  })
  return user?.resellerBotToken || null
}

/** GET /api/bot/webhook — get current webhook info from Telegram */
export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getBotToken(session.user.id)
  if (!token) return Response.json({ error: "Bot token not configured" }, { status: 400 })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ error: "Failed to get webhook info" }, { status: 502 })
  }
}

/** POST /api/bot/webhook — set webhook URL */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getBotToken(session.user.id)
  if (!token) return Response.json({ error: "Bot token not configured" }, { status: 400 })

  try {
    const body = await request.json()
    const webhookUrl = body.url?.trim()
    if (!webhookUrl) return Response.json({ error: "url is required" }, { status: 400 })

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
    })
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ error: "Failed to set webhook" }, { status: 502 })
  }
}

/** DELETE /api/bot/webhook — remove webhook (back to polling) */
export async function DELETE() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getBotToken(session.user.id)
  if (!token) return Response.json({ error: "Bot token not configured" }, { status: 400 })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drop_pending_updates: false }),
    })
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ error: "Failed to delete webhook" }, { status: 502 })
  }
}
