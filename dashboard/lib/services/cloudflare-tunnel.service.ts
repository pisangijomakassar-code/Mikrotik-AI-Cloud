import crypto from "crypto"

// ── Environment ──────────────────────────────────────────────────────────────

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!
const TUNNEL_DOMAIN = process.env.CLOUDFLARE_TUNNEL_DOMAIN!
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID!

const CF_BASE = "https://api.cloudflare.com/client/v4"

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cfFetch(path: string, options?: RequestInit): Promise<unknown> {
  const url = `${CF_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  const body = await res.json() as { success: boolean; errors?: { message: string }[]; result?: unknown }

  if (!res.ok || !body.success) {
    const msg = body.errors?.map((e) => e.message).join("; ") ?? `HTTP ${res.status}`
    throw new Error(`Cloudflare API error on ${path}: ${msg}`)
  }

  return body.result
}

function tunnelHostname(serviceName: string, routerId: string): string {
  return `${serviceName}-${routerId}.${TUNNEL_DOMAIN}`
}

// ── Exported API ──────────────────────────────────────────────────────────────

export interface CreateTunnelPort {
  serviceName: string
  remotePort: number
}

export interface CreatedTunnelPort {
  serviceName: string
  hostname: string
}

export interface CreateCloudflareTunnelResult {
  tunnelId: string
  token: string
  ports: CreatedTunnelPort[]
}

/**
 * Create a named Cloudflare tunnel for a router, configure ingress rules,
 * and create DNS CNAME records for each enabled port.
 */
export async function createCloudflareTunnel(
  routerId: string,
  routerLanIp: string,
  enabledPorts: CreateTunnelPort[],
): Promise<CreateCloudflareTunnelResult> {
  // 1. Create tunnel
  const tunnelSecret = crypto.randomBytes(32).toString("base64")
  const created = await cfFetch(`/accounts/${ACCOUNT_ID}/tunnels`, {
    method: "POST",
    body: JSON.stringify({
      name: `rt-${routerId}`,
      tunnel_secret: tunnelSecret,
    }),
  }) as { id: string }

  const tunnelId = created.id

  // 2. Fetch token
  const tokenResult = await cfFetch(
    `/accounts/${ACCOUNT_ID}/tunnels/${tunnelId}/token`,
  ) as string

  // 3. Configure ingress
  const ingressRules = enabledPorts.map((p) => ({
    hostname: tunnelHostname(p.serviceName, routerId),
    service: `tcp://${routerLanIp}:${p.remotePort}`,
  }))
  ingressRules.push({ hostname: "", service: "http_status:404" })

  await cfFetch(`/accounts/${ACCOUNT_ID}/tunnels/${tunnelId}/configurations`, {
    method: "PUT",
    body: JSON.stringify({
      config: { ingress: ingressRules },
    }),
  })

  // 4. Create DNS CNAME records (parallel)
  const ports: CreatedTunnelPort[] = await Promise.all(
    enabledPorts.map(async (p) => {
      const hostname = tunnelHostname(p.serviceName, routerId)
      await cfFetch(`/zones/${ZONE_ID}/dns_records`, {
        method: "POST",
        body: JSON.stringify({
          type: "CNAME",
          name: hostname,
          content: `${tunnelId}.cfargotunnel.com`,
          proxied: true,
          ttl: 1,
        }),
      })
      return { serviceName: p.serviceName, hostname }
    }),
  )

  return { tunnelId, token: tokenResult, ports }
}

/**
 * Delete a Cloudflare tunnel and its associated DNS CNAME records.
 */
export async function deleteCloudflareTunnel(cloudflareTunnelId: string): Promise<void> {
  const cfTarget = `${cloudflareTunnelId}.cfargotunnel.com`

  // 1. Delete DNS records that point to this tunnel
  const dnsRecords = await cfFetch(
    `/zones/${ZONE_ID}/dns_records?type=CNAME&page=1&per_page=100`,
  ) as Array<{ id: string; content: string }>

  const toDelete = dnsRecords.filter((r) => r.content === cfTarget)

  await Promise.all(
    toDelete.map((r) =>
      cfFetch(`/zones/${ZONE_ID}/dns_records/${r.id}`, { method: "DELETE" }),
    ),
  )

  // 2. Delete tunnel
  await cfFetch(`/accounts/${ACCOUNT_ID}/tunnels/${cloudflareTunnelId}`, {
    method: "DELETE",
  })
}

/**
 * Get the current status of a Cloudflare tunnel.
 */
export async function getCloudflareTunnelStatus(
  cloudflareTunnelId: string,
): Promise<"PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR"> {
  const tunnel = await cfFetch(
    `/accounts/${ACCOUNT_ID}/tunnels/${cloudflareTunnelId}`,
  ) as { status: string }

  switch (tunnel.status) {
    case "active":
      return "CONNECTED"
    case "inactive":
      return "DISCONNECTED"
    case "degraded":
      return "ERROR"
    default:
      return "PENDING"
  }
}

/**
 * Retrieve a fresh token for an existing Cloudflare tunnel.
 */
export async function regenerateCloudflareTunnelToken(
  cloudflareTunnelId: string,
): Promise<string> {
  const token = await cfFetch(
    `/accounts/${ACCOUNT_ID}/tunnels/${cloudflareTunnelId}/token`,
  ) as string
  return token
}
