import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getUsers, createUser } from "@/lib/services/user.service"
import type { UserFilter } from "@/lib/types"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const filter: UserFilter = {}

    const status = searchParams.get("status")
    if (status) filter.status = status as UserFilter["status"]

    const role = searchParams.get("role")
    if (role) filter.role = role as UserFilter["role"]

    const search = searchParams.get("search")
    if (search) filter.search = search

    const users = await getUsers(filter)
    return Response.json(users)
  } catch (error) {
    console.error("Failed to fetch users:", error)
    return Response.json(
      { error: "Failed to fetch users" },
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

    if (!body.name || !body.telegramId) {
      return Response.json(
        { error: "Name and Telegram ID are required" },
        { status: 400 }
      )
    }

    const user = await createUser(body)
    return Response.json(user, { status: 201 })
  } catch (error: unknown) {
    console.error("Failed to create user:", error)
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A user with this email or Telegram ID already exists"
        : "Failed to create user"
    return Response.json({ error: message }, { status: 400 })
  }
}
