import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      botToken: true,
      role: true,
      status: true,
      tenantId: true,
      createdAt: true,
      lastActiveAt: true,
      validUntil: true,
      isLocked: true,
      notifAsOwner: true,
      notifAsReseller: true,
    },
  })

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  // Router count per-tenant (Router sekarang owned by Tenant, bukan User)
  const routerCount = user.tenantId
    ? await prisma.router.count({ where: { tenantId: user.tenantId } })
    : 0

  return Response.json({
    ...user,
    _count: { routers: routerCount },
  })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, email, oldPassword, newPassword } = body as {
    name?: string
    email?: string
    oldPassword?: string
    newPassword?: string
  }

  // Handle change password
  if (oldPassword !== undefined && newPassword !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { passwordHash: true },
    })

    if (!user?.passwordHash) {
      return Response.json({ error: "Password tidak dikonfigurasi" }, { status: 400 })
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!isValid) {
      return Response.json({ error: "Password lama tidak sesuai" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return Response.json({ error: "Password baru minimal 6 karakter" }, { status: 400 })
    }

    const newHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: session.user.id as string },
      data: { passwordHash: newHash },
    })

    return Response.json({ success: true })
  }

  // Handle profile field update
  const { telegramId, botToken, validUntil, isLocked, notifAsOwner, notifAsReseller } = body as {
    telegramId?: string
    botToken?: string
    validUntil?: string | null
    isLocked?: boolean
    notifAsOwner?: boolean
    notifAsReseller?: boolean
  }

  const updateData: Record<string, string | boolean | Date | null> = {}
  if (name?.trim()) updateData.name = name.trim()
  if (email !== undefined) updateData.email = email?.trim() || ""
  if (telegramId?.trim()) updateData.telegramId = telegramId.trim()
  if (botToken !== undefined) updateData.botToken = botToken?.trim() || null
  if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null
  if (typeof isLocked === "boolean") updateData.isLocked = isLocked
  if (typeof notifAsOwner === "boolean") updateData.notifAsOwner = notifAsOwner
  if (typeof notifAsReseller === "boolean") updateData.notifAsReseller = notifAsReseller

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "Tidak ada field yang diperbarui" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id as string },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      botToken: true,
      role: true,
      status: true,
      validUntil: true,
      isLocked: true,
      notifAsOwner: true,
      notifAsReseller: true,
    },
  })

  return Response.json(user)
}
