import { prisma } from "../db"
import type { CreateRouterInput } from "../types"

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
  return prisma.router.create({
    data: {
      name: data.name,
      host: data.host,
      port: data.port ?? 8728,
      username: data.username,
      passwordEnc: data.password,
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
