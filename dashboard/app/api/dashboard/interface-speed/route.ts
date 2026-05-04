import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface SpeedPoint {
  t: number
  txMbps: number
  rxMbps: number
}

// GET /api/dashboard/interface-speed?router=X&iface=Y
// Returns real-time Tx/Rx Mbps rates from TrafficSnapshot deltas.
// Also returns list of available interfaces for the selector.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const tenantId = session.user.tenantId
  const routerName = request.nextUrl.searchParams.get("router")
  const ifaceParam = request.nextUrl.searchParams.get("iface") || ""

  if (!routerName) return Response.json({ error: "router required" }, { status: 400 })

  // Interfaces active in last 2 hours
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const ifaceRows = await prisma.trafficSnapshot.findMany({
    where: { tenantId, routerName, takenAt: { gte: since } },
    select: { interfaceName: true },
    distinct: ["interfaceName"],
    orderBy: { interfaceName: "asc" },
  })
  const interfaces = ifaceRows.map((r) => r.interfaceName)

  // Priority: explicit param → wanInterface → first available
  const router = await prisma.router.findFirst({
    where: { tenantId, name: routerName },
    select: { wanInterface: true },
  })
  const selectedIface = ifaceParam || router?.wanInterface?.trim() || interfaces[0] || ""

  if (!selectedIface) {
    return Response.json({ interfaces, interfaceName: "", currentTxMbps: 0, currentRxMbps: 0, points: [] })
  }

  // Last 31 snapshots → 30 delta points (~5 jam pada interval 10 menit)
  const snaps = await prisma.trafficSnapshot.findMany({
    where: { tenantId, routerName, interfaceName: selectedIface },
    select: { takenAt: true, txBytes: true, rxBytes: true },
    orderBy: { takenAt: "desc" },
    take: 31,
  })
  snaps.reverse()

  const points: SpeedPoint[] = []
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1]
    const curr = snaps[i]
    const deltaSec = (curr.takenAt.getTime() - prev.takenAt.getTime()) / 1000
    if (deltaSec <= 0 || deltaSec > 3600) continue
    const txDelta = Math.max(0, Number(curr.txBytes) - Number(prev.txBytes))
    const rxDelta = Math.max(0, Number(curr.rxBytes) - Number(prev.rxBytes))
    points.push({
      t: curr.takenAt.getTime(),
      txMbps: +(txDelta * 8 / deltaSec / 1_000_000).toFixed(2),
      rxMbps: +(rxDelta * 8 / deltaSec / 1_000_000).toFixed(2),
    })
  }

  const last = points[points.length - 1]

  return Response.json({
    interfaces,
    interfaceName: selectedIface,
    currentTxMbps: last?.txMbps ?? 0,
    currentRxMbps: last?.rxMbps ?? 0,
    points,
  })
}
