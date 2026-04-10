import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/tunnels
// Returns all tunnels with their ports for the current user's routers.
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const tunnels = await prisma.tunnel.findMany({
      where: {
        router: {
          userId: session.user.id,
        },
      },
      include: {
        ports: true,
        router: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(tunnels)
  } catch (error) {
    console.error("Failed to fetch tunnels:", error)
    return Response.json({ error: "Failed to fetch tunnels" }, { status: 500 })
  }
}
