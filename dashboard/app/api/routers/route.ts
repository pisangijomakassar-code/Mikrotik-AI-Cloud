import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getRouters, createRouter } from "@/lib/services/router.service"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") ?? undefined

    // Non-admin users only see their own routers
    const userId =
      session.user.role === "ADMIN" ? undefined : session.user.id

    const routers = await getRouters(userId, search)
    return Response.json(routers)
  } catch (error) {
    console.error("Failed to fetch routers:", error)
    return Response.json(
      { error: "Failed to fetch routers" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!body.name || !body.host || !body.username || !body.password || !body.userId) {
      return Response.json(
        { error: "Name, host, username, password, and userId are required" },
        { status: 400 }
      )
    }

    const router = await createRouter(body)
    return Response.json(router, { status: 201 })
  } catch (error: unknown) {
    console.error("Failed to create router:", error)
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A router with this name already exists for this user"
        : "Failed to create router"
    return Response.json({ error: message }, { status: 400 })
  }
}
