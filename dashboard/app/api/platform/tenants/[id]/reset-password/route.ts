import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

async function guard() {
  const session = await auth()
  if (!session?.user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "SUPER_ADMIN") return { error: Response.json({ error: "Forbidden" }, { status: 403 }) }
  return { error: null }
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guard()
  if (error) return error

  const { id } = await params
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) return Response.json({ error: "Not found" }, { status: 404 })

  const user = await prisma.user.findFirst({
    where: { tenantId: id, role: "ADMIN" },
    select: { id: true, email: true },
  })
  if (!user) return Response.json({ error: "No admin user found for this tenant" }, { status: 404 })

  const newPassword = randomBytes(8).toString("hex")
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

  return Response.json({ email: user.email, password: newPassword })
}
