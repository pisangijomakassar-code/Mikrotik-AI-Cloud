import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { botToken: string }

    if (!body.botToken) {
      return Response.json(
        { error: "botToken is required" },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { resellerBotToken: body.botToken },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to update reseller bot token:", error)
    return Response.json(
      { error: "Failed to update reseller bot token" },
      { status: 500 }
    )
  }
}
