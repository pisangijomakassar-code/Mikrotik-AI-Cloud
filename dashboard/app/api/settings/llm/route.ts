import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { agentFetch } from "@/lib/agent-fetch"
import {
  getLlmSettings, saveLlmSettings, detectProvider, maskApiKey,
  POPULAR_MODELS, type LlmProvider,
} from "@/lib/services/llm-settings.service"

// GET /api/settings/llm
// Returns current settings (key masked) + dropdown options.
export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await getLlmSettings()
  return Response.json({
    provider: settings?.provider ?? "openrouter",
    model: settings?.model ?? "google/gemini-2.5-flash",
    apiKeyMasked: settings ? maskApiKey(settings.apiKey) : "",
    hasKey: !!(settings?.apiKey),
    updatedAt: settings?.updatedAt ?? null,
    models: POPULAR_MODELS,
  })
}

// PUT /api/settings/llm
// body: { provider?, model, apiKey? } — kalau apiKey kosong, tidak diubah.
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  // Admin only — LLM key sensitif, jangan biarkan user biasa ganti.
  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Admin access required" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      provider?: LlmProvider
      model: string
      apiKey?: string
    }

    if (!body.model) {
      return Response.json({ error: "model required" }, { status: 400 })
    }

    // Auto-detect provider kalau apiKey diberikan tapi provider tidak
    let provider = body.provider
    if (body.apiKey && !provider) {
      provider = detectProvider(body.apiKey)
    }
    if (!provider) {
      const existing = await getLlmSettings()
      provider = existing?.provider ?? "openrouter"
    }

    // Kalau apiKey kosong/undefined, keep existing
    let apiKeyToSave = body.apiKey ?? ""
    if (!apiKeyToSave) {
      const existing = await getLlmSettings()
      apiKeyToSave = existing?.apiKey ?? ""
    }

    const saved = await saveLlmSettings(session.user.id, provider, apiKeyToSave, body.model)

    // Trigger nanobot reload via agent — write new config.json + restart
    try {
      await agentFetch("/llm-reload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: saved.provider,
          model: saved.model,
          apiKey: apiKeyToSave,  // plaintext (sekali ini), agent akan tulis ke config.json
        }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)
    } catch { /* best-effort */ }

    return Response.json({
      ok: true,
      provider: saved.provider,
      model: saved.model,
      apiKeyMasked: maskApiKey(saved.apiKey),
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
