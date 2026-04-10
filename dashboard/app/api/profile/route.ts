import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
      createdAt: true,
      lastActiveAt: true,
      _count: { select: { routers: true } },
    },
  })

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  return Response.json(user)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, email } = body as { name?: string; email?: string }

  const updateData: Record<string, string> = {}
  if (name?.trim()) updateData.name = name.trim()
  if (email !== undefined) updateData.email = email?.trim() || ""

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id as string },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      role: true,
      status: true,
    },
  })

  return Response.json(user)
}
