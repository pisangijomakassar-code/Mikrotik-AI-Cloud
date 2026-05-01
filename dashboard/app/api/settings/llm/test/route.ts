import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { detectProvider, testLlmKey, type LlmProvider } from "@/lib/services/llm-settings.service"

// POST /api/settings/llm/test
// body: { apiKey, provider? }
// Returns: { ok: bool, provider: detected, error? }
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = (await request.json()) as { apiKey: string; provider?: LlmProvider }
    if (!body.apiKey) {
      return Response.json({ ok: false, error: "apiKey required" }, { status: 400 })
    }
    const provider = body.provider ?? detectProvider(body.apiKey)
    const result = await testLlmKey(provider, body.apiKey)
    return Response.json({ ...result, provider })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
