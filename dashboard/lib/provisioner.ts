import fs from "fs"
import path from "path"
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

  // No docker restart needed — the agent container's entrypoint watches
  // config.generated.json via inotifywait and hot-reloads nanobot automatically

  await prisma.user.updateMany({
    where: { status: "ACTIVE" },
    data: { isProvisioned: true },
  })

  return { restarted: true, usersProvisioned: users.length }
}
