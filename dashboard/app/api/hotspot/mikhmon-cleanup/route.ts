import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/hotspot/mikhmon-cleanup
// Body: { router: string, retentionMonths: number, dryRun?: boolean }
// Deletes Mikhmon /system script entries older than `retentionMonths` from
// RouterOS. Run /api/hotspot/mikhmon-import first (deleteAfterImport=false)
// to ensure data is mirrored to PostgreSQL before deletion.
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
    const res = await fetch(`${agentUrl}/mikhmon-cleanup/${user.telegramId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to cleanup Mikhmon scripts" }, { status: 502 })
  }
}
