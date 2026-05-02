import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function guard() {
  const session = await auth()
  if (!session?.user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "SUPER_ADMIN") return { error: Response.json({ error: "Forbidden" }, { status: 403 }) }
  return { error: null }
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guard()
  if (error) return error

  const { id } = await params
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, routers: true } },
      users: { select: { id: true, email: true, role: true, createdAt: true } },
    },
  })
  if (!tenant) return Response.json({ error: "Not found" }, { status: 404 })
  return Response.json(tenant)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guard()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { name, ownerEmail, status, expiresAt, trialEndsAt } = body

  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(ownerEmail !== undefined && { ownerEmail }),
      ...(status !== undefined && { status }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      ...(trialEndsAt !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
    },
    include: { _count: { select: { users: true, routers: true } } },
  })

  return Response.json(tenant)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guard()
  if (error) return error

  const { id } = await params
  const tenant = await prisma.tenant.update({
    where: { id },
    data: { status: "CHURNED" },
  })
  return Response.json(tenant)
}
