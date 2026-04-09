import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getRouter, deleteRouter } from "@/lib/services/router.service"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const router = await getRouter(id)
    if (!router) {
      return Response.json({ error: "Router not found" }, { status: 404 })
    }

    // Non-admin can only view their own routers
    if (session.user.role !== "ADMIN" && router.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    return Response.json(router)
  } catch (error) {
    console.error("Failed to fetch router:", error)
    return Response.json(
      { error: "Failed to fetch router" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    await deleteRouter(id)
    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to delete router:", error)
    return Response.json(
      { error: "Failed to delete router" },
      { status: 500 }
    )
  }
}
