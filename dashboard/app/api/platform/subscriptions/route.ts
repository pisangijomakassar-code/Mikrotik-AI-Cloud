import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function guard() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export async function GET() {
  const err = await guard()
  if (err) return err

  const subs = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tenant: {
        select: {
          id: true, name: true, slug: true, status: true,
          _count: { select: { routers: true } },
        },
      },
    },
  })
  return Response.json(subs)
}
