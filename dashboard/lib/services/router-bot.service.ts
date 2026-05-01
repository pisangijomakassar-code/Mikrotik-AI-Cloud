import { agentFetch } from "@/lib/agent-fetch"

export async function encryptBotToken(plaintext: string): Promise<string> {
  try {
    const res = await agentFetch(`/encrypt-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: plaintext }),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = (await res.json()) as { encrypted?: string }
      if (data.encrypted) return data.encrypted
    }
  } catch {
    // Agent unreachable — fallback ke plaintext (Python decrypt() handle gracefully)
  }
  return plaintext
}

export async function decryptBotToken(ciphertext: string): Promise<string> {
  if (!ciphertext) return ""
  try {
    const res = await agentFetch(`/decrypt-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ciphertext }),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = (await res.json()) as { plaintext?: string }
      if (data.plaintext) return data.plaintext
    }
  } catch {
    // Agent unreachable — assume plaintext
  }
  return ciphertext
}

export interface TelegramBotInfo {
  id?: number
  username?: string
  first_name?: string
  can_join_groups?: boolean
  can_read_all_group_messages?: boolean
}

export interface TelegramWebhookInfo {
  url?: string
  has_custom_certificate?: boolean
  pending_update_count?: number
  last_error_date?: number
  last_error_message?: string
  max_connections?: number
  ip_address?: string
}

export async function tgGetMe(token: string): Promise<TelegramBotInfo | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ok?: boolean; result?: TelegramBotInfo }
    return data.ok ? (data.result ?? null) : null
  } catch {
    return null
  }
}

export async function tgGetWebhookInfo(token: string): Promise<TelegramWebhookInfo | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ok?: boolean; result?: TelegramWebhookInfo }
    return data.ok ? (data.result ?? null) : null
  } catch {
    return null
  }
}

export async function tgSetWebhook(token: string, url: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, allowed_updates: ["message", "callback_query"] }),
      signal: AbortSignal.timeout(10000),
    })
    return (await res.json()) as { ok: boolean; description?: string }
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "Network error" }
  }
}

export async function tgDeleteWebhook(token: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drop_pending_updates: false }),
      signal: AbortSignal.timeout(10000),
    })
    return (await res.json()) as { ok: boolean; description?: string }
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "Network error" }
  }
}
