import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true, id: true },
    })


    const agentUrl =
      process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

    const agentRes = await fetch(
      `${agentUrl}/ai-insight/${user.telegramId ?? user.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
      }
    )

    if (!agentRes.ok) {
      const errorText = await agentRes.text().catch(() => "Unknown error")
      console.error("AI insight failed:", errorText)
      return Response.json(
        { error: `AI insight failed: ${errorText}` },
        { status: 502 }
      )
    }

    const data = await agentRes.json()
    return Response.json(data)
  } catch (error) {
    console.error("AI insight error:", error)
    return Response.json(
      { error: "Failed to generate AI insight" },
      { status: 500 }
    )
  }
}
