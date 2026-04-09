import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as net from "net"

interface RouterHealth {
  id: string
  name: string
  status: "online" | "offline"
}

function checkTcp(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => { socket.destroy(); resolve(true) })
    socket.once("timeout", () => { socket.destroy(); resolve(false) })
    socket.once("error", () => { socket.destroy(); resolve(false) })
    socket.connect(port, host)
  })
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const where =
      session.user.role === "ADMIN" ? {} : { userId: session.user.id }
    const routers = await prisma.router.findMany({
      where,
      select: { id: true, name: true, host: true, port: true },
    })

    const results: RouterHealth[] = await Promise.all(
      routers.map(async (router) => {
        const reachable = await checkTcp(router.host, router.port)
        if (reachable) {
          await prisma.router.update({
            where: { id: router.id },
            data: { lastSeen: new Date() },
          })
        }
        return {
          id: router.id,
          name: router.name,
          status: reachable ? "online" : "offline",
        }
      })
    )

    return Response.json(results)
  } catch (error) {
    console.error("Health check failed:", error)
    return Response.json({ error: "Health check failed" }, { status: 500 })
  }
}
