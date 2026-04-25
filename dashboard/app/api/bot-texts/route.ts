import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Keys stored in SystemSetting for bot texts
export const BOT_TEXT_KEYS = [
  "bot_text_welcome",
  "bot_text_not_registered",
  "bot_text_saldo",
  "bot_text_buy_confirm",
  "bot_text_buy_success",
  "bot_text_deposit_info",
  "bot_text_deposit_req",
  "bot_text_deposit_sent",
] as const

export const BOT_TEXT_DEFAULTS: Record<string, string> = {
  bot_text_welcome: "Halo {name}! Saldo: {saldo}",
  bot_text_not_registered: "Anda belum terdaftar. Hubungi admin untuk didaftarkan.",
  bot_text_saldo: "Saldo Anda: {saldo}",
  bot_text_buy_confirm: "Konfirmasi beli voucher *{nama}*?\nHarga: {harga}\nSaldo setelah: {saldo_setelah}",
  bot_text_buy_success: "✅ Voucher berhasil dibeli!\nUsername: `{username}`\nPassword: `{password}`\nSisa saldo: {saldo}",
  bot_text_deposit_info: "Pilih nominal deposit:",
  bot_text_deposit_req: "Permintaan deposit *{nominal}* telah dikirim ke admin.",
  bot_text_deposit_sent: "✅ Deposit *{nominal}* berhasil dikonfirmasi. Saldo baru: {saldo}",
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...BOT_TEXT_KEYS] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  // Merge with defaults
  const result: Record<string, string> = {}
  for (const key of BOT_TEXT_KEYS) {
    result[key] = map[key] ?? BOT_TEXT_DEFAULTS[key] ?? ""
  }
  return Response.json(result)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json() as Record<string, string>

    for (const [key, value] of Object.entries(body)) {
      if (!BOT_TEXT_KEYS.includes(key as typeof BOT_TEXT_KEYS[number])) continue
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }
    return Response.json({ ok: true })
  } catch (e) {
    console.error(e)
    return Response.json({ error: "Failed to save bot texts" }, { status: 500 })
  }
}
