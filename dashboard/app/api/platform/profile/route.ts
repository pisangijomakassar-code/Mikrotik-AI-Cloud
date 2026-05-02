import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, createdAt: true, lastActiveAt: true },
  })
  if (!user) return Response.json({ error: "Not found" }, { status: 404 })
  return Response.json(user)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const { name, currentPassword, newPassword } = await request.json()

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return Response.json({ error: "Not found" }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name

  if (newPassword) {
    if (!currentPassword) return Response.json({ error: "Current password required" }, { status: 400 })
    if (!user.passwordHash) return Response.json({ error: "No password set" }, { status: 400 })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return Response.json({ error: "Current password is incorrect" }, { status: 400 })
    data.passwordHash = await bcrypt.hash(newPassword, 10)
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, email: true, name: true, createdAt: true, lastActiveAt: true },
  })
  return Response.json(updated)
}
