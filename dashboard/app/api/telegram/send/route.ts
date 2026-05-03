import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true },
    })

    if (!user?.telegramId) {
      return Response.json({ error: "User has no Telegram ID configured" }, { status: 400 })
    }

    const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
    const contentType = request.headers.get("content-type") ?? ""

    let agentRes: Response

    if (contentType.includes("multipart/form-data")) {
      // Forward FormData (with photo) as-is to agent
      const formData = await request.formData()
      const message = formData.get("message") as string
      const chatId = formData.get("chatId") as string | null
      const chatIds = formData.get("chatIds") as string | null

      if (!message) {
        return Response.json({ error: "message is required" }, { status: 400 })
      }
      if (!chatId && !chatIds) {
        return Response.json({ error: "chatId or chatIds is required" }, { status: 400 })
      }

      // Rebuild FormData for agent (Next.js formData is already parsed)
      const outForm = new FormData()
      if (chatId) outForm.append("chatId", chatId)
      if (chatIds) outForm.append("chatIds", chatIds)
      outForm.append("message", message)
      const photo = formData.get("photo") as File | null
      if (photo) outForm.append("photo", photo, photo.name)

      agentRes = await fetch(`${agentUrl}/send-telegram/${user.telegramId}`, {
        method: "POST",
        body: outForm,
        signal: AbortSignal.timeout(20000),
      })
    } else {
      const body = (await request.json()) as {
        chatId?: string
        chatIds?: string[]
        message: string
      }

      if (!body.message) {
        return Response.json({ error: "message is required" }, { status: 400 })
      }
      if (!body.chatId && !body.chatIds?.length) {
        return Response.json({ error: "chatId or chatIds is required" }, { status: 400 })
      }

      agentRes = await fetch(`${agentUrl}/send-telegram/${user.telegramId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: body.chatId,
          chat_ids: body.chatIds,
          message: body.message,
        }),
        signal: AbortSignal.timeout(8000),
      })
    }

    if (!agentRes.ok) {
      const errorText = await agentRes.text().catch(() => "Unknown error")
      return Response.json({ error: `Failed to send Telegram message: ${errorText}` }, { status: 502 })
    }

    const data = await agentRes.json()
    return Response.json(data)
  } catch (error) {
    console.error("Telegram send error:", error)
    return Response.json({ error: "Failed to send Telegram message" }, { status: 500 })
  }
}
