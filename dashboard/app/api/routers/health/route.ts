import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as net from "net"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

interface RouterHealth {
  id: string
  name: string
  status: "online" | "offline"
  cpuLoad?: number
  memoryPercent?: number
  uptime?: string
  activeClients?: number
  version?: string
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

async function getRouterDetails(host: string, port: number, username: string, password: string): Promise<Partial<RouterHealth>> {
  try {
    const script = `
import json, librouteros
try:
    api = librouteros.connect(host='${host}', port=${port}, username='${username}', password='${password}', timeout=5)
    res = list(api.path('/system/resource'))
    leases = list(api.path('/ip/dhcp-server/lease'))
    active = len([l for l in leases if l.get('status') == 'bound'])
    api.close()
    r = res[0] if res else {}
    total = int(r.get('total-memory', 0))
    free = int(r.get('free-memory', 0))
    mem = round((total - free) / total * 100) if total else 0
    print(json.dumps({"cpuLoad": r.get('cpu-load', 0), "memoryPercent": mem, "uptime": r.get('uptime', ''), "version": r.get('version', ''), "activeClients": active}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`
    const { stdout } = await execFileAsync("docker", [
      "exec", "mikrotik-agent", "python3", "-c", script
    ], { timeout: 15000 })
    return JSON.parse(stdout.trim())
  } catch {
    return {}
  }
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
      select: { id: true, name: true, host: true, port: true, username: true, passwordEnc: true },
    })

    const results: RouterHealth[] = await Promise.all(
      routers.map(async (router) => {
        const reachable = await checkTcp(router.host, router.port)
        if (!reachable) {
          return { id: router.id, name: router.name, status: "offline" as const }
        }

        // Get detailed stats via agent container (has librouteros)
        const details = await getRouterDetails(router.host, router.port, router.username, router.passwordEnc)

        await prisma.router.update({
          where: { id: router.id },
          data: { lastSeen: new Date(), routerosVersion: details.version || undefined },
        })

        return {
          id: router.id,
          name: router.name,
          status: "online" as const,
          cpuLoad: details.cpuLoad ?? 0,
          memoryPercent: details.memoryPercent ?? 0,
          uptime: details.uptime ?? "",
          activeClients: details.activeClients ?? 0,
          version: details.version ?? "",
        }
      })
    )

    return Response.json(results)
  } catch (error) {
    console.error("Health check failed:", error)
    return Response.json({ error: "Health check failed" }, { status: 500 })
  }
}
