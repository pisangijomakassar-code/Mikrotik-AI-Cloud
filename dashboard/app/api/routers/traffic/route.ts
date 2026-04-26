import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) return Response.json({ interfaces: [] })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/router-traffic/${user.telegramId}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) return Response.json(await res.json())
  } catch { /* fallthrough */ }

  return Response.json({ interfaces: [] })
}
