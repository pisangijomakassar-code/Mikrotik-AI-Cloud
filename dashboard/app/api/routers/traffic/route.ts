import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const telegramId = session.user.telegramId
  if (!telegramId) return Response.json({ interfaces: [] })

  const router = request.nextUrl.searchParams.get("router")
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/router-traffic/${telegramId}${qs}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) return Response.json(await res.json())
  } catch { /* fallthrough */ }

  return Response.json({ interfaces: [] })
}
