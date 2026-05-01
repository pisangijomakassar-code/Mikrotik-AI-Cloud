import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { agentFetch } from "@/lib/agent-fetch"
import { fetchOpenRouterModels, getLlmSettings } from "@/lib/services/llm-settings.service"

// GET /api/settings/llm/models?provider=openrouter
// Fetch live model list dari provider. Saat ini cuma OpenRouter yg di-support
// (paling banyak free models). Provider lain pakai POPULAR_MODELS hardcoded.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const provider = request.nextUrl.searchParams.get("provider") ?? "openrouter"
  if (provider !== "openrouter") {
    return Response.json({ models: [], note: "Live fetch hanya untuk openrouter" })
  }

  // Decrypt key dari DB supaya bisa pakai untuk fetch (some endpoint butuh auth)
  let plainKey: string | undefined
  const settings = await getLlmSettings()
  if (settings?.apiKey?.startsWith("gAAAAA")) {
    try {
      const res = await agentFetch("/decrypt-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: settings.apiKey }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = (await res.json()) as { plaintext?: string }
        plainKey = data.plaintext
      }
    } catch { /* fallback no key */ }
  } else if (settings?.apiKey) {
    plainKey = settings.apiKey
  }

  const models = await fetchOpenRouterModels(plainKey)
  return Response.json({
    models,
    counts: {
      total: models.length,
      free: models.filter((m) => m.tier === "free").length,
      cheap: models.filter((m) => m.tier === "cheap").length,
      premium: models.filter((m) => m.tier === "premium").length,
    },
  })
}
