import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { execFileSync } from "child_process"

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

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get routers for this user (or all for admin)
    const where =
      session.user.role === "ADMIN" ? {} : { userId: session.user.id }
    const routers = await prisma.router.findMany({
      where,
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        username: true,
        passwordEnc: true,
        userId: true,
        user: { select: { telegramId: true } },
      },
    })

    // Check health via MCP server's librouteros (Python script)
    const results: RouterHealth[] = []

    for (const router of routers) {
      try {
        const output = execFileSync("python3", [
          "-c",
          `
import json, socket, sys
sys.path.insert(0, '/app/mikrotik_mcp')
import librouteros

try:
    api = librouteros.connect(host='${router.host}', port=${router.port}, username='${router.username}', password='${router.passwordEnc}', timeout=5)
    res = list(api.path('/system/resource'))
    leases = list(api.path('/ip/dhcp-server/lease'))
    active = len([l for l in leases if l.get('status') == 'bound'])
    api.close()
    if res:
        r = res[0]
        total = int(r.get('total-memory', 0))
        free = int(r.get('free-memory', 0))
        mem_pct = round((total - free) / total * 100) if total else 0
        print(json.dumps({"status": "online", "cpuLoad": r.get('cpu-load', 0), "memoryPercent": mem_pct, "uptime": r.get('uptime', ''), "version": r.get('version', ''), "activeClients": active}))
    else:
        print(json.dumps({"status": "online"}))
except Exception as e:
    print(json.dumps({"status": "offline", "error": str(e)}))
`,
        ], { timeout: 10000 }).toString().trim()

        const health = JSON.parse(output)
        results.push({ id: router.id, name: router.name, ...health })

        // Update lastSeen if online
        if (health.status === "online") {
          await prisma.router.update({
            where: { id: router.id },
            data: { lastSeen: new Date(), routerosVersion: health.version || undefined },
          })
        }
      } catch {
        results.push({ id: router.id, name: router.name, status: "offline" })
      }
    }

    return Response.json(results)
  } catch (error) {
    console.error("Health check failed:", error)
    return Response.json({ error: "Health check failed" }, { status: 500 })
  }
}
