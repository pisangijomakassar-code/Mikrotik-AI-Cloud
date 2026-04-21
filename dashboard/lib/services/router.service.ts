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
    },
    include: {
      user: { select: { name: true } },
    },
  })
}

export async function deleteRouter(id: string) {
  return prisma.router.delete({
    where: { id },
  })
}
