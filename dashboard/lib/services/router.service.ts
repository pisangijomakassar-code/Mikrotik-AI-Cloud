import { auth } from "../auth"
import { getTenantDb } from "../db-tenant"
import type { CreateRouterInput } from "../types"
import { agentFetch } from "@/lib/agent-fetch"

async function requireTenantId(): Promise<string> {
  const session = await auth()
  const tenantId = session?.user?.tenantId
  if (!tenantId) throw new Error("No tenant context (super admin?)")
  return tenantId
}

/** Ask the Python agent to Fernet-encrypt a password.
 *  Falls back to storing plaintext if the agent is unreachable (dev/offline). */
async function encryptPassword(plaintext: string): Promise<string> {
  try {
    const res = await agentFetch(`/encrypt-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: plaintext }),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json() as { encrypted?: string }
      if (data.encrypted) return data.encrypted
    }
  } catch {
    // Agent unreachable (offline dev) — store plaintext; Python crypto.py
    // decrypt() already handles plaintext fallback gracefully.
  }
  return plaintext
}

/**
 * Router service — semua operasi tenant-scoped via getTenantDb().
 * Router sekarang owned by Tenant (tidak ada relation ke User lagi).
 */

export async function getRouters(search?: string) {
  const db = await getTenantDb()
  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { host: { contains: search, mode: "insensitive" } },
      { label: { contains: search, mode: "insensitive" } },
    ]
  }

  return db.router.findMany({
    where,
    orderBy: { addedAt: "desc" },
  })
}

export async function getRouter(id: string) {
  const db = await getTenantDb()
  return db.router.findFirst({ where: { id } })
}

export async function createRouter(data: CreateRouterInput) {
  const db = await getTenantDb()
  const tenantId = await requireTenantId()
  const encryptedPassword = await encryptPassword(data.password)
  const encryptedBotToken = data.botToken ? await encryptPassword(data.botToken) : ""

  return db.router.create({
    data: {
      tenantId,
      name: data.name,
      host: data.host,
      port: data.port ?? 8728,
      username: data.username,
      passwordEnc: encryptedPassword,
      label: data.label ?? "",
      isDefault: data.isDefault ?? false,
      wanInterface: data.wanInterface ?? "",
      dnsHotspot: data.dnsHotspot ?? "",
      hotspotName: data.hotspotName ?? "",
      hotspotLogoUrl: data.hotspotLogoUrl ?? "",
      telegramOwnerUsername: data.telegramOwnerUsername ?? "",
      telegramOwnerId: data.telegramOwnerId ?? "",
      botToken: encryptedBotToken,
      botUsername: data.botUsername ?? "",
    },
  })
}

export async function updateRouter(id: string, data: Partial<CreateRouterInput>) {
  const db = await getTenantDb()
  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.host !== undefined) updateData.host = data.host
  if (data.port !== undefined) updateData.port = data.port
  if (data.username !== undefined) updateData.username = data.username
  if (data.label !== undefined) updateData.label = data.label ?? ""
  if (data.isDefault !== undefined) updateData.isDefault = data.isDefault
  if (data.password !== undefined) {
    updateData.passwordEnc = await encryptPassword(data.password)
  }
  if (data.wanInterface !== undefined) updateData.wanInterface = data.wanInterface
  if (data.dnsHotspot !== undefined) updateData.dnsHotspot = data.dnsHotspot
  if (data.hotspotName !== undefined) updateData.hotspotName = data.hotspotName
  if (data.hotspotLogoUrl !== undefined) updateData.hotspotLogoUrl = data.hotspotLogoUrl
  if (data.telegramOwnerUsername !== undefined) updateData.telegramOwnerUsername = data.telegramOwnerUsername
  if (data.telegramOwnerId !== undefined) updateData.telegramOwnerId = data.telegramOwnerId
  if (data.botUsername !== undefined) updateData.botUsername = data.botUsername
  if (data.botToken !== undefined) {
    updateData.botToken = data.botToken ? await encryptPassword(data.botToken) : ""
  }

  return db.router.update({ where: { id }, data: updateData })
}

export async function deleteRouter(id: string) {
  const db = await getTenantDb()
  return db.router.delete({ where: { id } })
}
