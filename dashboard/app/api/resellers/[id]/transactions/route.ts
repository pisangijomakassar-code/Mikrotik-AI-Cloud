import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { listTransactions } from "@/lib/services/reseller.service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") ?? "1", 10)
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10)

    const data = await listTransactions(id, page, pageSize)
    if (!data) {
      return Response.json({ error: "Reseller not found" }, { status: 404 })
    }
    return Response.json(data)
  } catch (error) {
    console.error("Failed to fetch transactions:", error)
    return Response.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    )
  }
}
