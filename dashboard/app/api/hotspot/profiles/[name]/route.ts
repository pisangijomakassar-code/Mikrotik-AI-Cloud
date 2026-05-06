import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

type Ctx = { params: Promise<{ name: string }> }

async function getUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true, id: true } })
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await getUser(session.user.id)

  const { name } = await params
  const router = request.nextUrl.searchParams.get("router")
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

  try {
    const res = await fetch(
      `${agentUrl}/hotspot-profiles/${user.telegramId ?? user.id}/${encodeURIComponent(name)}${qs}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to fetch profile" }, { status: 502 })
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await getUser(session.user.id)

  const { name } = await params
  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

  try {
    const body = await request.json()
    const res = await fetch(
      `${agentUrl}/hotspot-profile/${user.telegramId ?? user.id}/${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    )
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to update profile" }, { status: 502 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await getUser(session.user.id)

  const { name } = await params
  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

  try {
    const res = await fetch(
      `${agentUrl}/hotspot-profile/${user.telegramId ?? user.id}/${encodeURIComponent(name)}`,
      { method: "DELETE", signal: AbortSignal.timeout(8000) }
    )
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to delete profile" }, { status: 502 })
  }
}
