import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface TokenUsageInput {
  userId: string
  tokensIn: number
  tokensOut: number
  model: string
  sessionId: string
}

function trackTokenUsage(input: TokenUsageInput) {
  prisma.$executeRawUnsafe(
    `INSERT INTO "TokenUsage" (id, "userId", "tokensIn", "tokensOut", model, "sessionId", timestamp)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
    input.userId,
    input.tokensIn,
    input.tokensOut,
    input.model,
    input.sessionId
  ).catch((err: unknown) =>
    console.error("Failed to track token usage:", err)
  )
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { message, image, history } = body as {
      message: string
      image?: string
      history?: Array<{ role: string; content: string }>
    }

    if (!message && !image) {
      return Response.json(
        { error: "Message or image is required" },
        { status: 400 }
      )
    }

    // Lookup user's agent config for per-user agent routing
    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { botToken: true, telegramId: true, name: true, agentUrl: true },
    })

    if (!user?.botToken || !user?.agentUrl) {
      return Response.json({
        reply:
          "Your AI agent is not configured yet. Please contact the administrator to set up your bot token and agent URL.",
      })
    }

    // Build messages array with full conversation history
    const apiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = []

    // Include conversation history if provided
    if (history && history.length > 0) {
      for (const msg of history) {
        apiMessages.push({ role: msg.role, content: msg.content })
      }
    } else {
      // Fallback: single message (no history)
      if (image) {
        apiMessages.push({
          role: "user",
          content: [
            ...(message ? [{ type: "text" as const, text: message }] : []),
            { type: "image_url" as const, image_url: { url: image } },
          ],
        })
      } else {
        apiMessages.push({ role: "user", content: message })
      }
    }

    const sessionId = `dashboard-${session.user.id}`

    // Route to user's dedicated nanobot agent
    const agentUrl = user.agentUrl

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const apiResponse = await fetch(`${agentUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bot-Token": user.botToken,
          "X-Telegram-Id": user.telegramId,
        },
        body: JSON.stringify({
          messages: apiMessages,
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

        // Track token usage for billing (model available after migration)
        const usage = data.usage as
          | { prompt_tokens?: number; completion_tokens?: number }
          | undefined
        if (usage) {
          trackTokenUsage({
            userId: session.user.id as string,
            tokensIn: usage.prompt_tokens ?? 0,
            tokensOut: usage.completion_tokens ?? 0,
            model: (data as { model?: string }).model ?? "",
            sessionId,
          })
        }

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
