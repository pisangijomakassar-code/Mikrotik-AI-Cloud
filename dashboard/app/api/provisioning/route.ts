import { auth } from "@/lib/auth"
import { syncAndRestart } from "@/lib/provisioner"

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await syncAndRestart()
    return Response.json(result)
  } catch (error) {
    console.error("Provisioning failed:", error)
    const message =
      error instanceof Error ? error.message : "Provisioning failed"
    return Response.json({ error: message }, { status: 500 })
  }
}
