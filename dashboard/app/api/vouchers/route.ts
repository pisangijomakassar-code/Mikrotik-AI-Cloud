import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { listVoucherBatches } from "@/lib/services/reseller.service"
import type { VoucherFilter } from "@/lib/types"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams

    const filter: VoucherFilter = {}
    const source = searchParams.get("source")
    const resellerId = searchParams.get("resellerId")
    const page = searchParams.get("page")
    const pageSize = searchParams.get("pageSize")

    if (source) filter.source = source
    if (resellerId) filter.resellerId = resellerId
    if (page) filter.page = parseInt(page, 10)
    if (pageSize) filter.pageSize = parseInt(pageSize, 10)

    const data = await listVoucherBatches(session.user.id, filter)
    return Response.json(data)
  } catch (error) {
    console.error("Failed to fetch voucher batches:", error)
    return Response.json(
      { error: "Failed to fetch voucher batches" },
      { status: 500 }
    )
  }
}
