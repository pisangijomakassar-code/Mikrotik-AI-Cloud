import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getUser, updateUser, deleteUser } from "@/lib/services/user.service"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Non-admin can only view themselves
  if (session.user.role !== "ADMIN" && session.user.id !== id) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const user = await getUser(id)
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }
    return Response.json(user)
  } catch (error) {
    console.error("Failed to fetch user:", error)
    return Response.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    )
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
    const user = await updateUser(id, body)
    return Response.json(user)
  } catch (error: unknown) {
    console.error("Failed to update user:", error)
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A user with this email or Telegram ID already exists"
        : "Failed to update user"
    return Response.json({ error: message }, { status: 400 })
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

  // Prevent admin from deleting themselves
  if (session.user.id === id) {
    return Response.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    )
  }

  try {
    await deleteUser(id)
    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to delete user:", error)
    return Response.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
