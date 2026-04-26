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
    select: { telegramId: true },
  })
  if (!user?.telegramId) return Response.json([])

  const searchParams = request.nextUrl.searchParams
  const router = searchParams.get("router") || ""

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""

  try {
    const res = await fetch(
      `${agentUrl}/ppp-profiles/${user.telegramId}${qs}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (res.ok) return Response.json(await res.json())
  } catch { /* fallthrough */ }

  return Response.json([])
}
