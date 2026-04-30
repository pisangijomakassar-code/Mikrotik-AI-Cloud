import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/routers/traffic-monthly?router=<name>&year=&month=
//                                 ?router=<name>&start=<iso>&end=<iso>
// Proxy ke agent /router-traffic-monthly/<telegramId>
// Sumber data: TrafficSnapshot (di-poll cron 10 menit di agent).
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
    return Response.json({ interfaces: [], totalTx: 0, totalRx: 0 })
  }

  const sp = request.nextUrl.searchParams
  const qs = new URLSearchParams()
  for (const k of ["router", "year", "month", "start", "end"]) {
    const v = sp.get(k)
    if (v) qs.set(k, v)
  }

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  try {
    const res = await fetch(
      `${agentUrl}/router-traffic-monthly/${user.telegramId}?${qs.toString()}`,
      { signal: AbortSignal.timeout(15000) },
    )
    const data = await res.json()
    return Response.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return Response.json(
      { interfaces: [], totalTx: 0, totalRx: 0, error: "Agent unreachable" },
      { status: 502 },
    )
  }
}
