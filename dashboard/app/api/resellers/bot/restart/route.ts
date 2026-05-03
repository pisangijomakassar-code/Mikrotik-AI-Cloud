import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/db-tenant"
import { agentFetch } from "@/lib/agent-fetch"

// POST /api/resellers/bot/restart?routerId=X
// Hot-reload bot thread di agent tanpa restart container.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerId = request.nextUrl.searchParams.get("routerId")
  if (!routerId) return Response.json({ error: "routerId required" }, { status: 400 })

  // Validasi ownership (tenant-scoped via getTenantDb)
  const db = await getTenantDb()
  const router = await db.router.findFirst({
    where: { id: routerId },
    select: { id: true },
  })
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  try {
    const res = await agentFetch(`/reseller-bot/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ router_id: routerId }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch (e) {
    return Response.json(
      { error: "Agent unreachable", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    )
  }
}
