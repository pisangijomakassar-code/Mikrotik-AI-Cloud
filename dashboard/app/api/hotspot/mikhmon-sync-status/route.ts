import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/hotspot/mikhmon-sync-status
// Returns last auto-sync info per router (from agent in-memory cache) +
// /system script storage usage estimate (count + bytes).
export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true, id: true },
  })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/mikhmon-sync-status/${user.telegramId ?? user.id}`, {
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to fetch sync status" }, { status: 502 })
  }
}
