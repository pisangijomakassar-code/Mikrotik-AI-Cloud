import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { agentFetch } from "@/lib/agent-fetch"

// GET /api/netwatch?router=<name>
// Proxy ke agent /netwatch/<tgId> untuk list netwatch entries di MikroTik.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) {
    return Response.json({ items: [] })
  }

  const router = request.nextUrl.searchParams.get("router")
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""

  try {
    const res = await agentFetch(`/netwatch/${user.telegramId}${qs}`, {
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json({ error: "Failed to fetch netwatch" }, { status: 502 })
  }
}
