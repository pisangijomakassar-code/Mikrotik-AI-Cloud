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
  const routerName = searchParams.get("router") || ""
  const count = searchParams.get("count") || "50"

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const path = routerName
    ? `/router-logs/${user.telegramId ?? user.id}/${encodeURIComponent(routerName)}?count=${count}`
    : `/router-logs/${user.telegramId ?? user.id}?count=${count}`

  try {
    const res = await fetch(`${agentUrl}${path}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return Response.json(await res.json())
  } catch { /* fallthrough */ }

  return Response.json({ logs: [], total: 0, router: "" })
}
