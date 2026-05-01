// Centralized fetch helper untuk call ke mikrotik-agent (port 8080).
// Otomatis tambah header `X-Agent-Token` dari env `AGENT_TOKEN` (kalau ada),
// supaya endpoint sensitif (decrypt-password, ovpn-user, dll) bisa pass auth.
//
// Pakai di SEMUA dashboard route handler yang call ke agent.

export const AGENT_URL =
  process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

export function agentFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${AGENT_URL}${path}`
  const token = process.env.AGENT_TOKEN
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  }
  if (token) headers["X-Agent-Token"] = token
  return fetch(url, { ...init, headers })
}
