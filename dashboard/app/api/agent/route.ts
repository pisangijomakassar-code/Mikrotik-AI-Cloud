import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/agent/status`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ running: false, error: "Agent unreachable" })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const { action } = await request.json() as { action: "stop" | "start" }
  if (action !== "stop" && action !== "start") {
    return Response.json({ error: "action must be stop or start" }, { status: 400 })
  }

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/agent/${action}`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ error: "Failed to control agent" }, { status: 502 })
  }
}
