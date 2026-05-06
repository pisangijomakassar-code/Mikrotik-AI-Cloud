import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true, id: true },
  })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const router = request.nextUrl.searchParams.get("router")
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""

  try {
    const res = await fetch(
      `${agentUrl}/hotspot-users/${user.telegramId ?? user.id}${qs}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) return Response.json(await res.json())
    const err = await res.json().catch(() => ({ error: "Agent error" }))
    return Response.json(err, { status: res.status })
  } catch {
    return Response.json(
      { error: "Failed to fetch hotspot users" },
      { status: 502 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true, id: true },
  })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const body = await request.json()

  try {
    const res = await fetch(
      `${agentUrl}/hotspot-user/${user.telegramId ?? user.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    )
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json(
      { error: "Failed to add hotspot user" },
      { status: 502 }
    )
  }
}
