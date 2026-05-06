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

  const searchParams = request.nextUrl.searchParams
  const router = searchParams.get("router") || ""

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""

  try {
    const res = await fetch(
      `${agentUrl}/ppp-secrets/${user.telegramId ?? user.id}${qs}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) return Response.json(await res.json())
  } catch { /* fallthrough */ }

  return Response.json([])
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

  const body = await request.json()
  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

  try {
    const res = await fetch(
      `${agentUrl}/ppp-secret/${user.telegramId ?? user.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      return Response.json(data, { status: res.status })
    }
    return Response.json(data)
  } catch (error) {
    console.error("Failed to add PPP secret:", error)
    return Response.json({ error: "Failed to add PPP secret" }, { status: 500 })
  }
}
