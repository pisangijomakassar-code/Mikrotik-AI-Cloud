import { redirect } from "next/navigation"

// Halaman lama Webhook Config sudah obsolete — sejak refactor 1 bot per router,
// konfigurasi webhook digabung ke /resellers/bot (per-router, ala Mikhbotam).
// Redirect supaya bookmark/link lama tetap berfungsi.
export default function LegacyWebhookRedirect() {
  redirect("/resellers/bot")
}
