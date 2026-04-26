import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { listResellers, createReseller } from "@/lib/services/reseller.service"
import type { CreateResellerInput } from "@/lib/types"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const data = await listResellers(session.user.id)
    return Response.json(data)
  } catch (error) {
    console.error("Failed to fetch resellers:", error)
    return Response.json(
      { error: "Failed to fetch resellers" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as CreateResellerInput

    if (!body.name) {
      return Response.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    const reseller = await createReseller(session.user.id, body)
    return Response.json(reseller, { status: 201 })
  } catch (error: unknown) {
    console.error("Failed to create reseller:", error)
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "A reseller with this name already exists"
        : "Failed to create reseller"
    return Response.json({ error: message }, { status: 400 })
  }
}
