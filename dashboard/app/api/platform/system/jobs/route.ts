import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const JOB_DEFS = [
  { key: "job.traffic_snapshot", name: "Traffic Snapshot", schedule: "Every 10 min", description: "Poll interface counters from all active routers" },
  { key: "job.snapshot_cleanup", name: "Snapshot Cleanup", schedule: "Weekly (Sun 02:00)", description: "Delete TrafficSnapshot records older than 12 months" },
  { key: "job.subscription_expiry", name: "Subscription Expiry Check", schedule: "Daily 00:05", description: "Mark expired tenants and send renewal reminders" },
  { key: "job.token_reset", name: "Token Usage Reset", schedule: "1st of month 00:01", description: "Reset tokensUsed on all subscriptions for new billing cycle" },
  { key: "job.audit_prune", name: "Audit Log Prune", schedule: "Weekly (Mon 03:00)", description: "Remove ActivityLog entries older than 90 days" },
]

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 })

  const keys = JOB_DEFS.map(j => j.key)
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
  const lastRunMap: Record<string, string> = {}
  for (const s of settings) lastRunMap[s.key] = s.value

  return Response.json(JOB_DEFS.map(j => ({ ...j, lastRun: lastRunMap[j.key] ?? null })))
}
