import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) {
    return Response.json({ error: "Telegram ID not configured" }, { status: 400 })
  }

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

  try {
    const res = await fetch(
      `${agentUrl}/ppp-active/${user.telegramId}/${encodeURIComponent(id)}/kick`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      return Response.json(data, { status: res.status })
    }
    return Response.json(data)
  } catch (error) {
    console.error("Failed to kick PPP session:", error)
    return Response.json({ error: "Failed to kick PPP session" }, { status: 500 })
  }
}
