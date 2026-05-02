import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const data = await req.json()
  const allowed = ["title", "body", "type", "active"] as const
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in data) update[k] = data[k]

  const ann = await prisma.announcement.update({ where: { id }, data: update })
  return Response.json(ann)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await prisma.announcement.delete({ where: { id } })
  return Response.json({ ok: true })
}
