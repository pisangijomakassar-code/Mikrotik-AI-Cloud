import fs from "fs"
import path from "path"
import { prisma } from "./db"

export async function syncAndRestart() {
  const now = new Date()

  // A user gets agent access only if: ACTIVE + not locked + subscription not expired
  const eligibleUsers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      isLocked: false,
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
  })

  const configPath = path.join(process.cwd(), "..", "config", "config.json")
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"))

  config.channels.telegram.allowFrom = eligibleUsers.map((u: { telegramId: string | null }) => u.telegramId).filter(Boolean)

  const outPath = path.join(
    process.cwd(),
    "..",
    "config",
    "config.generated.json"
  )
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2))

  // No docker restart needed — the agent container's entrypoint watches
  // config.generated.json via inotifywait and hot-reloads nanobot automatically

  const eligibleIds = eligibleUsers.map((u: { id: string }) => u.id)

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: eligibleIds } },
      data: { isProvisioned: true },
    }),
    prisma.user.updateMany({
      where: { id: { notIn: eligibleIds } },
      data: { isProvisioned: false },
    }),
  ])

  return { restarted: true, usersProvisioned: eligibleUsers.length }
}
