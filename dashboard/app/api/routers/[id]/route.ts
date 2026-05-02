import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getRouter, updateRouter, deleteRouter } from "@/lib/services/router.service"

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
    // getRouter() lewat getTenantDb() — sudah filter by tenantId.
    // Kalau router tidak ada (atau bukan milik tenant ini) → 404.
    const router = await getRouter(id)
    if (!router) {
      return Response.json({ error: "Router not found" }, { status: 404 })
    }

    return Response.json(router)
  } catch (error) {
    console.error("Failed to fetch router:", error)
    return Response.json({ error: "Failed to fetch router" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
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
    const body = await request.json()
    const router = await updateRouter(id, body)
    return Response.json(router)
  } catch (error) {
    console.error("Failed to update router:", error)
    return Response.json({ error: "Failed to update router" }, { status: 500 })
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
    return Response.json({ error: "Failed to delete router" }, { status: 500 })
  }
}
