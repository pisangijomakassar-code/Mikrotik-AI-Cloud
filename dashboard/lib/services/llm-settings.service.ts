import { prisma } from "../db"
import { agentFetch } from "../agent-fetch"

export type LlmProvider = "openrouter" | "openai" | "anthropic" | "google"

export interface LlmSettings {
  provider: LlmProvider
  apiKey: string         // empty atau encrypted (kalau dari DB)
  model: string
  updatedAt?: Date
  updatedBy?: string | null
}

// ── Auto-detect provider dari prefix API key ──────────────────────────────
//
// OpenRouter:  sk-or-v1-...
// Anthropic:   sk-ant-api03-...
// OpenAI:      sk-proj-... atau sk-svcacct-... atau sk-...
// Google AI:   AIza...
//
// Default fallback: openrouter (paling umum dipakai).
export function detectProvider(apiKey: string): LlmProvider {
  const k = apiKey.trim()
  if (k.startsWith("sk-or-")) return "openrouter"
  if (k.startsWith("sk-ant-")) return "anthropic"
  if (k.startsWith("AIza")) return "google"
  if (k.startsWith("sk-")) return "openai"
  return "openrouter"
}

// Daftar model populer per provider — buat dropdown UI quickpick.
// Untuk OpenRouter, list dynamic dari API juga tersedia via fetchOpenRouterModels().
export const POPULAR_MODELS: Record<LlmProvider, { id: string; label: string; tier: "free" | "cheap" | "premium" }[]> = {
  openrouter: [
    { id: "openai/gpt-oss-120b:free",                   label: "GPT-OSS 120B (free)",       tier: "free" },
    { id: "openai/gpt-oss-20b:free",                    label: "GPT-OSS 20B (free)",        tier: "free" },
    { id: "google/gemma-4-26b-a4b-it:free",             label: "Gemma 4 26B (free)",        tier: "free" },
    { id: "z-ai/glm-4.5-air:free",                      label: "GLM 4.5 Air (free)",        tier: "free" },
    { id: "google/gemini-2.5-flash",                    label: "Gemini 2.5 Flash",          tier: "cheap" },
    { id: "google/gemini-2.5-flash-lite",               label: "Gemini 2.5 Flash Lite",     tier: "cheap" },
    { id: "anthropic/claude-sonnet-4.5",                label: "Claude Sonnet 4.5",         tier: "premium" },
    { id: "openai/gpt-4o-mini",                         label: "GPT-4o Mini",               tier: "cheap" },
  ],
  openai: [
    { id: "gpt-4o-mini",       label: "GPT-4o Mini",      tier: "cheap" },
    { id: "gpt-4o",            label: "GPT-4o",           tier: "premium" },
    { id: "gpt-4.1-mini",      label: "GPT-4.1 Mini",     tier: "cheap" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5", tier: "cheap" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "premium" },
  ],
  google: [
    { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash",      tier: "cheap" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "cheap" },
    { id: "gemini-2.5-pro",        label: "Gemini 2.5 Pro",        tier: "premium" },
  ],
}

// ── Get / Save settings (singleton row di DB) ──────────────────────────────

export async function getLlmSettings(): Promise<LlmSettings | null> {
  const row = await prisma.appSettings.findUnique({ where: { id: "singleton" } })
  if (!row) return null
  return {
    provider: row.llmProvider as LlmProvider,
    apiKey: row.llmApiKey,
    model: row.llmModel,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  }
}

export async function saveLlmSettings(
  userId: string,
  provider: LlmProvider,
  plainApiKey: string,
  model: string,
): Promise<LlmSettings> {
  // Encrypt key via agent (Fernet)
  let encryptedKey = ""
  if (plainApiKey) {
    try {
      const res = await agentFetch("/encrypt-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: plainApiKey }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = (await res.json()) as { encrypted?: string }
        if (data.encrypted) encryptedKey = data.encrypted
      }
    } catch {
      // Agent unreachable — fallback simpan plaintext (Fernet decrypt() handle)
      encryptedKey = plainApiKey
    }
  }

  const row = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      llmProvider: provider,
      llmApiKey: encryptedKey,
      llmModel: model,
      updatedBy: userId,
    },
    update: {
      llmProvider: provider,
      llmApiKey: encryptedKey,
      llmModel: model,
      updatedBy: userId,
    },
  })

  return {
    provider: row.llmProvider as LlmProvider,
    apiKey: row.llmApiKey,
    model: row.llmModel,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  }
}

// ── Test connection ke provider ────────────────────────────────────────────
export async function testLlmKey(provider: LlmProvider, apiKey: string): Promise<{ ok: boolean; error?: string; model?: string }> {
  try {
    let url = ""
    let headers: Record<string, string> = {}

    if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/auth/key"
      headers = { Authorization: `Bearer ${apiKey}` }
    } else if (provider === "openai") {
      url = "https://api.openai.com/v1/models"
      headers = { Authorization: `Bearer ${apiKey}` }
    } else if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/models"
      headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    } else if (provider === "google") {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    }

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function maskApiKey(encryptedKey: string): string {
  if (!encryptedKey) return ""
  // Tampilkan placeholder kalau Fernet-encrypted (gAAAAA...)
  if (encryptedKey.startsWith("gAAAAA")) return "•••••••••••••••••••• (set)"
  // Plaintext fallback: tampilkan prefix + suffix
  if (encryptedKey.length <= 8) return "•".repeat(encryptedKey.length)
  return `${encryptedKey.slice(0, 6)}…${encryptedKey.slice(-4)}`
}

// Fetch live model list dari OpenRouter API. Return free models + populer cheap/premium.
// Pakai apiKey kalau ada (some endpoint require auth), fallback tanpa.
export async function fetchOpenRouterModels(apiKey?: string): Promise<{ id: string; label: string; tier: "free" | "cheap" | "premium" }[]> {
  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const res = await fetch("https://openrouter.ai/api/v1/models", { headers, signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    type Model = { id: string; name?: string; pricing?: { prompt?: string; completion?: string } }
    const data = (await res.json()) as { data: Model[] }

    return data.data
      .map((m) => {
        const promptCost = parseFloat(m.pricing?.prompt ?? "0")
        const completionCost = parseFloat(m.pricing?.completion ?? "0")
        const isFree = promptCost === 0 && completionCost === 0
        const isPremium = promptCost > 0.005 || completionCost > 0.015
        const tier: "free" | "cheap" | "premium" = isFree ? "free" : isPremium ? "premium" : "cheap"
        return {
          id: m.id,
          label: m.name || m.id,
          tier,
        }
      })
      .sort((a, b) => {
        // Order: free → cheap → premium, dalam tier alphabet
        const order = { free: 0, cheap: 1, premium: 2 }
        return order[a.tier] - order[b.tier] || a.label.localeCompare(b.label)
      })
  } catch {
    return []
  }
}
