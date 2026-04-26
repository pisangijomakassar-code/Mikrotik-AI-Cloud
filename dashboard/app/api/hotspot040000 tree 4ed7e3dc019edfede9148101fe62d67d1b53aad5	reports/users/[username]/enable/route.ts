import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) {
    return Response.json({ error: "Telegram ID not configured" }, { status: 400 })
  }

  const { username } = await params
  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

  try {
    const res = await fetch(
      `${agentUrl}/hotspot-user/${user.telegramId}/${encodeURIComponent(username)}/enable`,
      { method: "POST", signal: AbortSignal.timeout(15000) }
    )
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json(
      { error: "Failed to enable hotspot user" },
      { status: 502 }
    )
  }
}
