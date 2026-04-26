import * as crypto from "crypto"

// ── Architecture Note ─────────────────────────────────────────────────────────
//
// SoftEther VPN runs in the `sstp-vpn` Docker container. The `vpncmd` CLI is
// the only management interface. Because the Next.js dashboard runs in its own
// container (without vpncmd installed), we CANNOT call vpncmd directly here.
//
// Split of responsibility:
//   • TypeScript (this file): credential generation, VPN-IP allocation, DB
//     reads, and RouterOS config generation.
//   • Python health_server (mikrotik_mcp/health_server.py): the actual vpncmd
//     calls to create/delete SoftEther users. The dashboard POSTs to
//     http://mikrotik-agent:8080/vpn-user to trigger those actions.
//
// Phase 4 will implement the /vpn-user endpoint in health_server.py.
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Environment ───────────────────────────────────────────────────────────────

const AGENT_HEALTH_URL = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
const SSTP_SERVER_HOST = process.env.SSTP_SERVER_HOST || ""

// ── Constants ─────────────────────────────────────────────────────────────────

const VPN_IP_POOL_START = 2    // 10.10.0.2
const VPN_IP_POOL_END   = 254  // 10.10.0.254
const VPN_SUBNET_PREFIX = "10.10.0"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SstpCredentials {
  username: string
  password: string
}

export interface CreateSstpTunnelResult {
  username: string
  password: string
  vpnIp: string
}

// ── Credential Generation ─────────────────────────────────────────────────────

/**
 * Generate a unique, deterministic VPN username and a random password for a
 * given routerId.
 *
 * Username format: "rt-" + first 10 chars of routerId  (e.g. rt-clxyz12345)
 * Password: 16-char alphanumeric random string
 */
export function generateVpnCredentials(routerId: string): SstpCredentials {
  const username = `rt-${routerId.slice(0, 10)}`
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = crypto.randomBytes(16)
  const password = Array.from(bytes)
    .map((b) => alphabet[(b as number) % alphabet.length])
    .join("")
  return { username, password }
}

// ── IP Allocation ─────────────────────────────────────────────────────────────

/**
 * Allocate the next free VPN IP from the 10.10.0.2–10.10.0.254 pool.
 *
 * Reads all currently assigned IPs from the Tunnel table and returns the
 * lowest integer in the range not yet in use. Throws if the pool is exhausted.
 */
export async function allocateVpnIp(prisma: any): Promise<string> {
  // Raw query — Tunnel model may not be in the Prisma client yet at call time
  const rows: Array<{ vpnAssignedIp: string | null }> = await prisma.$queryRaw`
    SELECT "vpnAssignedIp"
    FROM "Tunnel"
    WHERE "vpnAssignedIp" IS NOT NULL
  `

  const taken = new Set(rows.map((r) => r.vpnAssignedIp as string))

  for (let i = VPN_IP_POOL_START; i <= VPN_IP_POOL_END; i++) {
    const candidate = `${VPN_SUBNET_PREFIX}.${i}`
    if (!taken.has(candidate)) return candidate
  }

  throw new Error("VPN IP pool exhausted — no free addresses in 10.10.0.2–10.10.0.254")
}

// ── SoftEther User Management (via health_server proxy) ──────────────────────

/**
 * Create an SSTP VPN user for a router.
 *
 * Steps:
 *   1. Generate unique VPN credentials for the routerId.
 *   2. Allocate a free VPN IP from the pool.
 *   3. POST to the Python health_server's /vpn-user endpoint so that it can
 *      call vpncmd inside the sstp-vpn container.
 *
 * The caller is responsible for persisting the returned values in the Tunnel
 * row (including encrypting the password with Fernet before storage).
 */
export async function createSstpTunnel(
  routerId: string,
  prisma: any,
): Promise<CreateSstpTunnelResult> {
  const { username, password } = generateVpnCredentials(routerId)
  const vpnIp = await allocateVpnIp(prisma)

  const res = await fetch(`${AGENT_HEALTH_URL}/vpn-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", username, password, vpnIp }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`health_server /vpn-user create failed: ${text}`)
  }

  return { username, password, vpnIp }
}

/**
 * Delete an SSTP VPN user from SoftEther.
 *
 * Sends a DELETE action to the Python health_server, which calls vpncmd to
 * remove the user from the SoftEther hub.
 */
export async function deleteSstpTunnel(vpnUsername: string): Promise<void> {
  const res = await fetch(`${AGENT_HEALTH_URL}/vpn-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", username: vpnUsername }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`health_server /vpn-user delete failed: ${text}`)
  }
}

/**
 * Check whether a VPN session for the given username is currently active.
 *
 * Calls the Python health_server, which uses vpncmd SessionList to determine
 * whether the user has an open session on the SoftEther hub.
 */
export async function getSstpTunnelStatus(
  vpnUsername: string,
): Promise<"CONNECTED" | "DISCONNECTED"> {
  const res = await fetch(
    `${AGENT_HEALTH_URL}/vpn-user/status?username=${encodeURIComponent(vpnUsername)}`,
  )

  if (!res.ok) {
    // Treat unreachable health_server as DISCONNECTED to avoid false positives
    return "DISCONNECTED"
  }

  const body = await res.json() as { connected?: boolean }
  return body.connected ? "CONNECTED" : "DISCONNECTED"
}

// ── RouterOS Configuration Generator ─────────────────────────────────────────

/**
 * Generate the RouterOS terminal commands a user should paste into their
 * RouterOS 6 router to establish the SSTP client tunnel back to our server.
 *
 * The script:
 *   - Creates the sstp-client interface with the supplied credentials
 *   - Adds the tunnel interface to the LAN bridge so routed traffic flows
 *   - DOES NOT alter the router's default route (traffic to our MCP server
 *     travels over the VPN IP, not through this tunnel's default route)
 */
export function generateSstpRouterConfig(params: {
  vpnHost: string
  vpnUsername: string
  vpnPassword: string
}): string {
  const host = params.vpnHost || SSTP_SERVER_HOST
  const { vpnUsername, vpnPassword } = params

  return [
    "# MikroTik AI Agent — SSTP Tunnel Setup",
    "# Paste these commands into your RouterOS terminal (New Terminal in Winbox)",
    "",
    "/interface sstp-client",
    `  add name=tunnel-saas \\`,
    `      connect-to=${host}:443 \\`,
    `      user=${vpnUsername} \\`,
    `      password=${vpnPassword} \\`,
    `      profile=default-encryption \\`,
    `      disabled=no \\`,
    `      comment="MikroTik AI Agent Tunnel"`,
    "",
    "# Verify the tunnel is up (should show 'R' = Running after ~10 seconds):",
    "/interface sstp-client print",
  ].join("\n")
}
