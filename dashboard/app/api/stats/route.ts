import { auth } from "@/lib/auth"
import { getUserStats } from "@/lib/services/user.service"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = await getUserStats()
    return Response.json(stats)
  } catch (error) {
    console.error("Failed to fetch stats:", error)
    return Response.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
