import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"

// GET /api/routers/quickstats?router=<name>
// Bundled stats untuk top-bar pills (CPU/RAM/HDD + hotspot count).
// Server-side cache 25s di agent untuk hemat beban RouterOS.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // telegramId is already in the JWT token via session callback in auth.ts
  const telegramId = session.user.telegramId
  if (!telegramId) return Response.json({ error: "No router configured" }, { status: 400 })

  const router = request.nextUrl.searchParams.get("router")
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/router-quickstats/${telegramId}${qs}`, {
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to fetch quickstats" }, { status: 502 })
  }
}
