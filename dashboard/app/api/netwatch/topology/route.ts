import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { agentFetch } from "@/lib/agent-fetch"

interface NetwatchItemFromAgent {
  id?: string; host?: string; status?: string; comment?: string
  interval?: string; since?: string
}

// GET /api/netwatch/topology?router=<name>
// Sync hosts dari /tool/netwatch (auto-create node baru) + return saved layout.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerName = request.nextUrl.searchParams.get("router")
  if (!routerName) return Response.json({ error: "router required" }, { status: 400 })

  // Resolve router id (must belong to user)
  const router = await prisma.router.findFirst({
    where: { userId: session.user.id, name: routerName },
    select: { id: true },
  })
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  // Fetch live netwatch state dari agent
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  let liveItems: NetwatchItemFromAgent[] = []
  if (user?.telegramId) {
    try {
      const res = await agentFetch(`/netwatch/${user.telegramId}?router=${encodeURIComponent(routerName)}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = (await res.json()) as { items?: NetwatchItemFromAgent[] }
        liveItems = data.items ?? []
      }
    } catch { /* ignore — masih bisa pakai saved layout */ }
  }

  // Auto-create node baru untuk host yg belum ada di topology
  const existing = await prisma.netwatchTopology.findMany({
    where: { routerId: router.id },
  })
  const existingHosts = new Set(existing.map((n) => n.host))
  const newHosts = liveItems.filter((i) => i.host && !existingHosts.has(i.host))

  if (newHosts.length > 0) {
    // Auto-place node baru di grid sederhana — owner bisa rearrange manual
    let i = 0
    await prisma.$transaction(
      newHosts.map((h) =>
        prisma.netwatchTopology.create({
          data: {
            routerId: router.id,
            host: h.host!,
            label: h.comment || h.host!,
            x: 100 + (i % 6) * 180,
            y: 200 + Math.floor(i++ / 6) * 120,
          },
        })
      )
    )
  }

  // Return all nodes (refetch to include new)
  const nodes = await prisma.netwatchTopology.findMany({
    where: { routerId: router.id },
    orderBy: { createdAt: "asc" },
  })

  // Merge with live status
  const liveByHost = new Map(liveItems.map((i) => [i.host, i]))
  const merged = nodes.map((n) => {
    const live = liveByHost.get(n.host)
    return {
      id: n.id,
      host: n.host,
      label: n.label || n.host,
      x: n.x,
      y: n.y,
      isCentral: n.isCentral,
      parentId: n.parentId,
      // Live state
      status: live?.status ?? "unknown",
      comment: live?.comment ?? "",
      since: live?.since ?? "",
    }
  })

  return Response.json({ nodes: merged, router: routerName })
}

// PUT /api/netwatch/topology
// Body: { router: name, nodes: [{id, x, y, parentId?, isCentral?, label?}, ...] }
// Bulk update positions + parent + label dari user drag-drop.
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as {
    router: string
    nodes: { id: string; x: number; y: number; parentId?: string | null; isCentral?: boolean; label?: string }[]
  }

  if (!body.router || !Array.isArray(body.nodes)) {
    return Response.json({ error: "router + nodes required" }, { status: 400 })
  }

  const router = await prisma.router.findFirst({
    where: { userId: session.user.id, name: body.router },
    select: { id: true },
  })
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  // Bulk update via $transaction (1 query per node, but batched)
  await prisma.$transaction(
    body.nodes.map((n) =>
      prisma.netwatchTopology.update({
        where: { id: n.id, routerId: router.id },  // safety: scope ke router
        data: {
          x: n.x,
          y: n.y,
          parentId: n.parentId ?? null,
          ...(n.isCentral !== undefined ? { isCentral: n.isCentral } : {}),
          ...(n.label !== undefined ? { label: n.label } : {}),
        },
      })
    )
  )

  return Response.json({ ok: true, updated: body.nodes.length })
}

// DELETE /api/netwatch/topology?router=X&id=Y — hapus 1 node dari topology
// (tidak hapus dari netwatch RouterOS, cuma dari layout kita).
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const routerName = request.nextUrl.searchParams.get("router")
  const nodeId = request.nextUrl.searchParams.get("id")
  if (!routerName || !nodeId) return Response.json({ error: "router+id required" }, { status: 400 })

  const router = await prisma.router.findFirst({
    where: { userId: session.user.id, name: routerName },
    select: { id: true },
  })
  if (!router) return Response.json({ error: "router not found" }, { status: 404 })

  await prisma.netwatchTopology.deleteMany({
    where: { id: nodeId, routerId: router.id },
  })
  return Response.json({ ok: true })
}
