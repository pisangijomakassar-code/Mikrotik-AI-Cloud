import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { type, router } = body as { type: "disabled" | "expired"; router?: string }

  if (type !== "disabled" && type !== "expired") {
    return Response.json({ error: "type must be 'disabled' or 'expired'" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) {
    return Response.json({ error: "Telegram ID not configured" }, { status: 400 })
  }

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/hotspot-cleanup/${user.telegramId}/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ router: router ?? "" }),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: "Failed to run cleanup" }, { status: 502 })
  }
}
