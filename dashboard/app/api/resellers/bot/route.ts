import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { resellerBotToken: true },
  })

  const token = user?.resellerBotToken ?? ""
  return Response.json({ token, active: !!token })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { token?: string; botToken?: string }
    const token = (body.token ?? body.botToken ?? "").trim()

    if (!token) {
      return Response.json({ error: "token is required" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { resellerBotToken: token },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to update reseller bot token:", error)
    return Response.json({ error: "Failed to update reseller bot token" }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { resellerBotToken: null },
    })
    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to deactivate reseller bot:", error)
    return Response.json({ error: "Failed to deactivate reseller bot" }, { status: 500 })
  }
}
