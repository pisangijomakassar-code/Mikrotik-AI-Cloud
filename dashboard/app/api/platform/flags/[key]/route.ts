import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function guard() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const err = await guard()
  if (err) return err

  const { key } = await params
  const { enabled, description } = await request.json()

  const flag = await prisma.featureFlag.update({
    where: { key },
    data: {
      ...(enabled !== undefined && { enabled }),
      ...(description !== undefined && { description }),
    },
  })
  return Response.json(flag)
}
