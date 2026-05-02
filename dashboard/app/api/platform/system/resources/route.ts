import { auth } from "@/lib/auth"
import os from "os"
import process from "process"

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const mem = process.memoryUsage()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  const cpus = os.cpus()
  const cpuLoad = cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
    return Math.round(((total - cpu.times.idle) / total) * 100)
  })
  const avgCpu = cpuLoad.length ? Math.round(cpuLoad.reduce((a, b) => a + b, 0) / cpuLoad.length) : 0

  return Response.json({
    uptime: Math.floor(os.uptime()),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpu: {
      model: cpus[0]?.model ?? "unknown",
      cores: cpus.length,
      avgLoadPercent: avgCpu,
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
    process: {
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
      externalBytes: mem.external,
    },
    loadAvg: os.loadavg(),
  })
}
