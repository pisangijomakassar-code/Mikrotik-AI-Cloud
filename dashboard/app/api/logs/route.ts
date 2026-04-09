import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getLogs } from "@/lib/services/log.service"
import type { LogFilter } from "@/lib/types"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const filter: LogFilter = {}

    // Non-admin users only see their own logs
    if (session.user.role !== "ADMIN") {
      filter.userId = session.user.id
    } else {
      const userId = searchParams.get("userId")
      if (userId) filter.userId = userId
    }

    const action = searchParams.get("action")
    if (action) filter.action = action

    const status = searchParams.get("status")
    if (status) filter.status = status

    const from = searchParams.get("from")
    if (from) filter.from = new Date(from)

    const to = searchParams.get("to")
    if (to) filter.to = new Date(to)

    const page = searchParams.get("page")
    if (page) filter.page = parseInt(page, 10)

    const pageSize = searchParams.get("pageSize")
    if (pageSize) filter.pageSize = parseInt(pageSize, 10)

    const result = await getLogs(filter)
    return Response.json(result)
  } catch (error) {
    console.error("Failed to fetch logs:", error)
    return Response.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    )
  }
}
