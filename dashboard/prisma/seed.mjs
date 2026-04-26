// Use require for CJS compat — Prisma generates TS client, not JS
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const bcrypt = require("bcryptjs")
const { PrismaClient } = require("../app/generated/prisma/index.js")

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@mikrotik.local"
  const password = process.env.ADMIN_PASSWORD || "admin123"

  // Only create on first deploy — never overwrite password on redeploy
  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    console.log("Admin already exists, skipping seed:", existing.email)
    return
  }

  const hash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash: hash,
      telegramId: process.env.TELEGRAM_USER_ID || "0",
      role: "ADMIN",
      status: "ACTIVE",
    },
  })

  console.log("Admin seeded:", user.email)
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
