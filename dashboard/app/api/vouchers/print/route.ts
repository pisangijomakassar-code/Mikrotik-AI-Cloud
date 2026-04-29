import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/vouchers/print
// Returns voucher batches matching the filter, plus the router branding meta
// (hotspotName, hotspotLogoUrl, dnsHotspot) used to render the printed cards.
//
// Query params:
//   mode       = "latest" (default) | "custom"
//   from, to   = ISO datetime (custom mode only)
//   resellerId = specific reseller id, "__none__" for batches without reseller, empty for all
//   profile    = profile name (empty for all)
//   routerName = router name (empty for default/first router)
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const mode = (sp.get("mode") ?? "latest") as "latest" | "custom"
  const from = sp.get("from")
  const to = sp.get("to")
  const resellerId = sp.get("resellerId")
  const profile = sp.get("profile")
  const routerName = sp.get("routerName") ?? undefined

  type BatchWhere = {
    userId: string
    resellerId?: string | null
    profile?: string
    routerName?: string
    createdAt?: { gte?: Date; lte?: Date }
  }

  try {
    const where: BatchWhere = { userId: session.user.id }

    if (resellerId === "__none__") {
      where.resellerId = null
    } else if (resellerId) {
      where.resellerId = resellerId
    }
    if (profile) where.profile = profile
    if (routerName) where.routerName = routerName

    if (mode === "custom") {
      const range: { gte?: Date; lte?: Date } = {}
      if (from) range.gte = new Date(from)
      if (to) {
        const end = new Date(to)
        // include the whole day when only date (no time) was provided
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setHours(23, 59, 59, 999)
        range.lte = end
      }
      if (range.gte || range.lte) where.createdAt = range
    }

    const batches = await prisma.voucherBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: mode === "latest" ? 1 : 200,
      include: {
        reseller: { select: { id: true, name: true } },
      },
    })

    // Resolve router meta: prefer explicit routerName, else first batch's router, else default.
    const targetRouterName =
      routerName ?? batches[0]?.routerName ?? undefined

    const router = targetRouterName
      ? await prisma.router.findFirst({
          where: { userId: session.user.id, name: targetRouterName },
          select: {
            name: true,
            hotspotName: true,
            hotspotLogoUrl: true,
            dnsHotspot: true,
          },
        })
      : await prisma.router.findFirst({
          where: { userId: session.user.id, isDefault: true },
          select: {
            name: true,
            hotspotName: true,
            hotspotLogoUrl: true,
            dnsHotspot: true,
          },
        })

    return Response.json({
      mode,
      batches: batches.map((b) => ({
        id: b.id,
        createdAt: b.createdAt.toISOString(),
        routerName: b.routerName,
        profile: b.profile,
        count: b.count,
        pricePerUnit: b.pricePerUnit,
        hargaEndUser: b.hargaEndUser,
        markUp: b.markUp,
        discount: b.discount,
        reseller: b.reseller,
        vouchers: b.vouchers as Array<{ username: string; password: string }>,
      })),
      router: router ?? { name: "", hotspotName: "", hotspotLogoUrl: "", dnsHotspot: "" },
    })
  } catch (e) {
    console.error("voucher print fetch failed:", e)
    return Response.json({ error: "Failed to fetch voucher print data" }, { status: 500 })
  }
}
