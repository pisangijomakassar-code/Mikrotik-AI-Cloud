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

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const router = request.nextUrl.searchParams.get("router")
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""

  try {
    const res = await fetch(
      `${agentUrl}/hotspot-profiles/${user.telegramId}${qs}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Agent error" }))
      return Response.json(err, { status: res.status })
    }

    const agentData = await res.json() as { profiles?: Array<{ name: string; rateLimit?: string; sharedUsers?: number; sessionTimeout?: string }> }
    const profiles = agentData.profiles ?? []

    // Merge price from VoucherProfileSetting per profile name
    const settings = await prisma.voucherProfileSetting.findMany({
      where: {
        userId: session.user.id,
        profileName: { in: profiles.map((p) => p.name) },
      },
      select: { profileName: true, price: true },
    })
    const priceMap = Object.fromEntries(settings.map((s) => [s.profileName, s.price]))

    const enriched = profiles.map((p) => ({
      ...p,
      price: priceMap[p.name] ?? 0,
    }))

    return Response.json(enriched)
  } catch {
    return Response.json(
      { error: "Failed to fetch hotspot profiles" },
      { status: 502 }
    )
  }
}
