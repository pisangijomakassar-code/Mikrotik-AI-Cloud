import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name } = await params

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { telegramId: true, id: true },
  })

  const agentUrl = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

  try {
    const res = await fetch(
      `${agentUrl}/ppp-secret/${user.telegramId ?? user.id}/${encodeURIComponent(name)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(8000),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      return Response.json(data, { status: res.status })
    }
    return Response.json(data)
  } catch (error) {
    console.error("Failed to remove PPP secret:", error)
    return Response.json({ error: "Failed to remove PPP secret" }, { status: 500 })
  }
}
