import { prisma } from "../lib/db"
import bcrypt from "bcryptjs"

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@mikrotik.local"
  const password = process.env.ADMIN_PASSWORD || "admin123"

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      passwordHash: await bcrypt.hash(password, 12),
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
