import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { topDownSaldo } from "@/lib/services/reseller.service"
import type { SaldoOperationInput } from "@/lib/types"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = (await request.json()) as SaldoOperationInput

    if (!body.amount || body.amount <= 0) {
      return Response.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      )
    }

    const transaction = await topDownSaldo(id, session.user.id, body)
    return Response.json(transaction, { status: 201 })
  } catch (error: unknown) {
    console.error("Failed to top down saldo:", error)
    const message =
      error instanceof Error ? error.message : "Failed to top down saldo"
    const status = message === "Saldo tidak mencukupi" ? 400 : 500
    return Response.json({ error: message }, { status })
  }
}
