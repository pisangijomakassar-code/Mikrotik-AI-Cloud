import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { message, image } = body as { message: string; image?: string }

    if (!message && !image) {
      return Response.json(
        { error: "Message or image is required" },
        { status: 400 }
      )
    }

    // Lookup user's botToken and telegramId for per-user agent routing
    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { botToken: true, telegramId: true, name: true },
    })

    if (!user?.botToken) {
      return Response.json({
        reply:
          "Your AI agent is not configured yet. Please contact the administrator to set up your bot token.",
      })
    }

    // Build messages for the OpenAI-compatible API
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

    if (message) {
      content.push({ type: "text", text: message })
    }

    if (image) {
      content.push({
        type: "image_url",
        image_url: { url: image },
      })
    }

    const sessionId = `dashboard-${session.user.id}`
    const nanobotUrl =
      process.env.NANOBOT_API_URL || "http://mikrotik-agent:8900"

    // Call nanobot OpenAI-compatible API with per-user context
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const apiResponse = await fetch(`${nanobotUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bot-Token": user.botToken,
          "X-Telegram-Id": user.telegramId,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: content.length === 1 ? message : content,
            },
          ],
          session_id: sessionId,
          user_context: {
            telegram_id: user.telegramId,
            bot_token: user.botToken,
            name: user.name,
          },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (apiResponse.ok) {
        const data = await apiResponse.json()
        const reply =
          data.choices?.[0]?.message?.content ||
          data.response ||
          "No response received."
        return Response.json({ reply })
      }

      // Non-OK response from nanobot
      console.error(
        "Nanobot API error:",
        apiResponse.status,
        await apiResponse.text().catch(() => "")
      )
      return Response.json({
        reply:
          "The MikroTik AI Agent is currently unavailable. Please try again later or use the Telegram bot.",
      })
    } catch (fetchError: unknown) {
      clearTimeout(timeout)
      const errMsg =
        fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.error("Failed to reach nanobot API:", errMsg)
      return Response.json({
        reply:
          "Chat via dashboard is connecting... The agent may not be reachable right now. Please try again or use Telegram.",
      })
    }
  } catch (error) {
    console.error("Chat API error:", error)
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
