import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/db-tenant"
import { listResellers, createReseller } from "@/lib/services/reseller.service"
import type { CreateResellerInput } from "@/lib/types"

// Resolve router name (from query / body) to routerId, scoped to current tenant.
// Falls back to tenant's default router (or oldest) if no name provided.
async function resolveRouterId(routerName: string | null): Promise<string | null> {
  const db = await getTenantDb()
  if (routerName) {
    const r = await db.router.findFirst({
      where: { name: routerName },
      select: { id: true },
    })
    return r?.id ?? null
  }
  const r = await db.router.findFirst({
    orderBy: [{ isDefault: "desc" }, { addedAt: "asc" }],
    select: { id: true },
  })
  return r?.id ?? null
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const routerName = request.nextUrl.searchParams.get("router")
    const routerId = await resolveRouterId(routerName)
    if (!routerId) return Response.json([])

    const data = await listResellers(routerId)
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
    const body = (await request.json()) as CreateResellerInput & { routerName?: string }

    if (!body.name) {
      return Response.json({ error: "Name is required" }, { status: 400 })
    }

    const routerId = await resolveRouterId(body.routerName ?? null)
    if (!routerId) {
      return Response.json(
        { error: "Tambah router terlebih dahulu sebelum membuat reseller" },
        { status: 400 },
      )
    }

    const reseller = await createReseller(routerId, body)
    return Response.json(reseller, { status: 201 })
  } catch (error: unknown) {
    console.error("Failed to create reseller:", error)
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Reseller dengan nama ini sudah ada di router yang sama"
        : "Failed to create reseller"
    return Response.json({ error: message }, { status: 400 })
  }
}
