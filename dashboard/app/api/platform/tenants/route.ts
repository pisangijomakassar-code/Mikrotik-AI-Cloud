import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

async function guard() {
  const session = await auth()
  if (!session?.user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "SUPER_ADMIN") return { error: Response.json({ error: "Forbidden" }, { status: 403 }) }
  return { error: null }
}

export async function GET(request: Request) {
  const { error } = await guard()
  if (error) return error

  const url = new URL(request.url)
  const status = url.searchParams.get("status") ?? undefined
  const expiringSoon = url.searchParams.get("expiringSoon") === "true"
  const search = url.searchParams.get("search") ?? ""

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (expiringSoon) {
    where.expiresAt = { lte: thirtyDaysFromNow, gte: new Date() }
    where.status = { in: ["ACTIVE", "TRIAL"] }
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { ownerEmail: { contains: search, mode: "insensitive" } },
    ]
  }

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, routers: true } } },
  })

  return Response.json(tenants)
}

export async function POST(request: Request) {
  const { error } = await guard()
  if (error) return error

  const body = await request.json()
  const { name, slug, ownerEmail, ownerPassword, status = "TRIAL", trialDays = 14, expiresAt } = body

  if (!name || !slug || !ownerEmail || !ownerPassword) {
    return Response.json(
      { error: "name, slug, ownerEmail, ownerPassword are required" },
      { status: 400 }
    )
  }

  const existing = await prisma.tenant.findUnique({ where: { slug } })
  if (existing) return Response.json({ error: "Slug already taken" }, { status: 409 })

  const trialEndsAt =
    status === "TRIAL"
      ? new Date(Date.now() + Number(trialDays) * 24 * 60 * 60 * 1000)
      : undefined

  const passwordHash = await bcrypt.hash(ownerPassword, 10)

  const [tenant] = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: { name, slug, ownerEmail, status, trialEndsAt, expiresAt: expiresAt ? new Date(expiresAt) : undefined },
    })
    await tx.user.create({
      data: { email: ownerEmail, passwordHash, role: "ADMIN", tenantId: created.id, name: ownerEmail },
    })
    const withCount = await tx.tenant.findUniqueOrThrow({
      where: { id: created.id },
      include: { _count: { select: { users: true, routers: true } } },
    })
    return [withCount]
  })

  return Response.json(tenant, { status: 201 })
}
