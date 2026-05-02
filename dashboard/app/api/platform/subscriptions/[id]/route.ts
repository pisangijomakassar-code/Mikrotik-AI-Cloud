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
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await guard()
  if (err) return err

  const { id } = await params
  const { plan, status, tokenLimit, billingCycleEnd } = await request.json()

  const sub = await prisma.subscription.update({
    where: { id },
    data: {
      ...(plan !== undefined && { plan }),
      ...(status !== undefined && { status }),
      ...(tokenLimit !== undefined && { tokenLimit: Number(tokenLimit) }),
      ...(billingCycleEnd !== undefined && { billingCycleEnd: billingCycleEnd ? new Date(billingCycleEnd) : null }),
    },
    include: { tenant: { select: { id: true, name: true, slug: true, status: true } } },
  })
  return Response.json(sub)
}
