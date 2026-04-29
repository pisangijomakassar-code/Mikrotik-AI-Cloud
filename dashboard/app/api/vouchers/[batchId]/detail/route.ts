import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface MikrotikUser {
  name: string
  password?: string
  uptime?: string
  comment?: string
  disabled?: string | boolean
  profile?: string
}

// GET /api/vouchers/<batchId>/detail
// Returns the batch + per-voucher live status by cross-referencing
// VoucherBatch.vouchers JSON with current /ip hotspot user state on RouterOS.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> },
) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { batchId } = await context.params

  const batch = await prisma.voucherBatch.findFirst({
    where: { id: batchId, userId: session.user.id },
    include: { reseller: { select: { id: true, name: true } } },
  })
  if (!batch) return Response.json({ error: "Batch not found" }, { status: 404 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true },
  })
  if (!user?.telegramId) return Response.json({ error: "No router configured" }, { status: 400 })

  // Live snapshot of /ip hotspot user from agent (so we can derive status).
  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
  const router = batch.routerName ? `?router=${encodeURIComponent(batch.routerName)}` : ""
  let userMap: Map<string, MikrotikUser> = new Map()
  try {
    const res = await fetch(`${agentUrl}/hotspot-users/${user.telegramId}${router}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      const json = await res.json()
      const users: MikrotikUser[] = json.users ?? json
      userMap = new Map(users.map((u) => [u.name, u]))
    }
  } catch {
    // Router unreachable — fall through with empty userMap (status='unknown').
  }

  const batchVouchers = (batch.vouchers as Array<{ username: string; password?: string }>) ?? []

  const vouchers = batchVouchers.map((v) => {
    const ros = userMap.get(v.username)
    let status: "unused" | "active" | "removed" | "unknown"
    if (!ros) {
      status = userMap.size === 0 ? "unknown" : "removed"
    } else {
      const uptime = ros.uptime ?? ""
      // uptime kosong "" or "0s" = belum login pertama
      const hasUptime = uptime && uptime !== "0s" && uptime !== "00:00:00"
      const isDisabled =
        String(ros.disabled).toLowerCase() === "true" || ros.disabled === true
      status = !hasUptime ? "unused" : isDisabled ? "removed" : "active"
    }
    return {
      username: v.username,
      password: v.password ?? ros?.password ?? "",
      status,
      uptime: ros?.uptime ?? "",
      comment: ros?.comment ?? "",
      profile: ros?.profile ?? batch.profile,
      disabled: String(ros?.disabled ?? "false").toLowerCase() === "true",
    }
  })

  const summary = {
    total: vouchers.length,
    unused: vouchers.filter((v) => v.status === "unused").length,
    active: vouchers.filter((v) => v.status === "active").length,
    removed: vouchers.filter((v) => v.status === "removed").length,
    unknown: vouchers.filter((v) => v.status === "unknown").length,
  }

  return Response.json({
    batch: {
      id: batch.id,
      createdAt: batch.createdAt.toISOString(),
      routerName: batch.routerName,
      profile: batch.profile,
      count: batch.count,
      pricePerUnit: batch.pricePerUnit,
      hargaEndUser: batch.hargaEndUser,
      markUp: batch.markUp,
      discount: batch.discount,
      source: batch.source,
      reseller: batch.reseller,
    },
    summary,
    vouchers,
  })
}
