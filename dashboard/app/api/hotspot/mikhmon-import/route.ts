import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) return Response.json({ error: "No router configured" }, { status: 400 })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const body = await request.json().catch(() => ({}))
    const res = await fetch(`${agentUrl}/mikhmon-import/${user.telegramId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to import Mikhmon data" }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) return Response.json({ scripts: [] })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const router = request.nextUrl.searchParams.get("router")
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  try {
    const res = await fetch(`${agentUrl}/mikhmon-scripts/${user.telegramId}${qs}`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to fetch Mikhmon scripts" }, { status: 502 })
  }
}
