import { auth } from "@/lib/auth"
import {
  getLlmSettings, saveLlmSettings, detectProvider, maskApiKey, POPULAR_MODELS,
  type LlmProvider,
} from "@/lib/services/llm-settings.service"

async function guard() {
  const session = await auth()
  if (!session?.user) return { session: null, err: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "SUPER_ADMIN") return { session: null, err: Response.json({ error: "Forbidden" }, { status: 403 }) }
  return { session, err: null }
}

export async function GET() {
  const { err } = await guard()
  if (err) return err

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

export async function PUT(request: Request) {
  const { session, err } = await guard()
  if (err || !session) return err!

  const body = await request.json() as { provider?: LlmProvider; model: string; apiKey?: string }
  const provider = body.provider ?? (body.apiKey ? detectProvider(body.apiKey) : "openrouter")

  await saveLlmSettings(session.user.id, provider, body.apiKey ?? "", body.model)
  return Response.json({ ok: true })
}
