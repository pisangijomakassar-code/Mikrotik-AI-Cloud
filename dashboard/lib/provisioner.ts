import fs from "fs"
import path from "path"
import { execFileSync } from "child_process"
import { prisma } from "./db"

export async function syncAndRestart() {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
  })

  const configPath = path.join(process.cwd(), "..", "config", "config.json")
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"))

  config.channels.telegram.allowFrom = users.map((u: { telegramId: string }) => u.telegramId)

  const outPath = path.join(
    process.cwd(),
    "..",
    "config",
    "config.generated.json"
  )
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2))

  // Restart via docker CLI using execFileSync (no shell injection risk)
  try {
    execFileSync("docker", ["restart", "mikrotik-agent"], { timeout: 30000 })
  } catch {
    return { restarted: false, error: "Failed to restart container", usersProvisioned: users.length }
  }

  await prisma.user.updateMany({
    where: { status: "ACTIVE" },
    data: { isProvisioned: true },
  })

  return { restarted: true, usersProvisioned: users.length }
}
