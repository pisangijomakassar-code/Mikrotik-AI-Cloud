import { prisma } from "../db"
import type { CreateRouterInput } from "../types"

/** Ask the Python agent to Fernet-encrypt a password.
 *  Falls back to storing plaintext if the agent is unreachable (dev/offline). */
async function encryptPassword(plaintext: string): Promise<string> {
  const agentUrl = process.env.AGENT_HEALTH_URL ?? "http://mikrotik-agent:8080"
  try {
    const res = await fetch(`${agentUrl}/encrypt-password`, {
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

export async function getRouters(userId?: string, search?: string) {
  const where: Record<string, unknown> = {}

  if (userId) {
    where.userId = userId
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { host: { contains: search, mode: "insensitive" } },
      { label: { contains: search, mode: "insensitive" } },
    ]
  }

  return prisma.router.findMany({
    where,
    include: {
      user: { select: { name: true } },
    },
    orderBy: { addedAt: "desc" },
  })
}

export async function getRouter(id: string) {
  return prisma.router.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
    },
  })
}

export async function createRouter(data: CreateRouterInput) {
  const encryptedPassword = await encryptPassword(data.password)
  const encryptedBotToken = data.botToken ? await encryptPassword(data.botToken) : ""

  return prisma.router.create({
    data: {
      name: data.name,
      host: data.host,
      port: data.port ?? 8728,
      username: data.username,
      passwordEnc: encryptedPassword,
      label: data.label ?? "",
      isDefault: data.isDefault ?? false,
      userId: data.userId,
      dnsHotspot: data.dnsHotspot ?? "",
      hotspotName: data.hotspotName ?? "",
      hotspotLogoUrl: data.hotspotLogoUrl ?? "",
      telegramOwnerUsername: data.telegramOwnerUsername ?? "",
      telegramOwnerId: data.telegramOwnerId ?? "",
      botToken: encryptedBotToken,
      botUsername: data.botUsername ?? "",
    },
    include: {
      user: { select: { name: true } },
    },
  })
}

export async function updateRouter(id: string, data: Partial<CreateRouterInput>) {
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
  if (data.dnsHotspot !== undefined) updateData.dnsHotspot = data.dnsHotspot
  if (data.hotspotName !== undefined) updateData.hotspotName = data.hotspotName
  if (data.hotspotLogoUrl !== undefined) updateData.hotspotLogoUrl = data.hotspotLogoUrl
  if (data.telegramOwnerUsername !== undefined) updateData.telegramOwnerUsername = data.telegramOwnerUsername
  if (data.telegramOwnerId !== undefined) updateData.telegramOwnerId = data.telegramOwnerId
  if (data.botUsername !== undefined) updateData.botUsername = data.botUsername
  if (data.botToken !== undefined) {
    // Encrypt non-empty tokens; empty string = clear the token
    updateData.botToken = data.botToken ? await encryptPassword(data.botToken) : ""
  }

  return prisma.router.update({
    where: { id },
    data: updateData,
    include: { user: { select: { name: true } } },
  })
}

export async function deleteRouter(id: string) {
  return prisma.router.delete({
    where: { id },
  })
}
