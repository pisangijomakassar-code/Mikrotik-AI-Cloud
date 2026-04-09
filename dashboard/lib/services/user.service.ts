import bcrypt from "bcryptjs"
import { prisma } from "../db"
import { syncAndRestart } from "../provisioner"
import type {
  CreateUserInput,
  UpdateUserInput,
  UserFilter,
  DashboardStats,
} from "../types"

export async function getUsers(filter?: UserFilter) {
  const where: Record<string, unknown> = {}

  if (filter?.status) {
    where.status = filter.status
  }
  if (filter?.role) {
    where.role = filter.role
  }
  if (filter?.search) {
    where.OR = [
      { name: { contains: filter.search, mode: "insensitive" } },
      { email: { contains: filter.search, mode: "insensitive" } },
      { telegramId: { contains: filter.search } },
    ]
  }

  return prisma.user.findMany({
    where,
    include: {
      _count: { select: { routers: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      routers: true,
      _count: { select: { routers: true, activityLogs: true } },
    },
  })
}

export async function createUser(data: CreateUserInput) {
  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 12)
    : null

  const user = await prisma.user.create({
    data: {
      email: data.email || null,
      passwordHash,
      name: data.name,
      telegramId: data.telegramId,
      botToken: data.botToken || null,
      role: data.role || "USER",
      status: data.status || "ACTIVE",
    },
    include: {
      _count: { select: { routers: true } },
    },
  })

  // Auto-sync: update nanobot allowFrom and restart agent
  if (data.status !== "INACTIVE") {
    syncAndRestart().catch((err) =>
      console.error("Auto-sync failed after user creation:", err)
    )
  }

  return user
}

export async function updateUser(id: string, data: UpdateUserInput) {
  const updateData: Record<string, unknown> = {}

  if (data.email !== undefined) updateData.email = data.email || null
  if (data.name !== undefined) updateData.name = data.name
  if (data.telegramId !== undefined) updateData.telegramId = data.telegramId
  if (data.botToken !== undefined) updateData.botToken = data.botToken || null
  if (data.role !== undefined) updateData.role = data.role
  if (data.status !== undefined) updateData.status = data.status
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 12)
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      _count: { select: { routers: true } },
    },
  })

  // Auto-sync on status change (ACTIVE/INACTIVE affects allowFrom)
  if (data.status !== undefined) {
    syncAndRestart().catch((err) =>
      console.error("Auto-sync failed after user update:", err)
    )
  }

  return user
}

export async function deleteUser(id: string) {
  const user = await prisma.user.delete({
    where: { id },
  })

  // Auto-sync: remove user from nanobot allowFrom
  syncAndRestart().catch((err) =>
    console.error("Auto-sync failed after user deletion:", err)
  )

  return user
}

export async function getUserStats(): Promise<DashboardStats> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [totalUsers, activeUsers, totalRouters, totalLogs, recentActivity] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.router.count(),
      prisma.activityLog.count(),
      prisma.activityLog.count({
        where: { timestamp: { gte: oneDayAgo } },
      }),
    ])

  return {
    totalUsers,
    activeUsers,
    totalRouters,
    totalLogs,
    recentActivity,
  }
}
