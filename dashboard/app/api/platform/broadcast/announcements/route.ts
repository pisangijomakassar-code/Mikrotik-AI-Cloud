import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } })
  return Response.json(announcements)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const { title, body, type } = await req.json()
  if (!title?.trim() || !body?.trim()) return Response.json({ error: "title and body required" }, { status: 400 })

  const ann = await prisma.announcement.create({
    data: { title: title.trim(), body: body.trim(), type: type ?? "info" },
  })
  return Response.json(ann, { status: 201 })
}
