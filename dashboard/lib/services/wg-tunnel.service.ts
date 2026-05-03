import * as crypto from "crypto"
import type { PrismaClient } from "@/app/generated/prisma/client"
import { agentFetch } from "@/lib/agent-fetch"

// ── Architecture Note ─────────────────────────────────────────────────────────
//
// WireGuard runs on the VPS host. Key generation is done purely in Node.js
// using the built-in `crypto.generateKeyPairSync('x25519')` API — no external
// wg CLI tools are required. The private key is Fernet-encrypted via the Python
// health_server before being stored in the database.
//
// Network layout:
//   • 10.8.0.0/16  — WireGuard address space
//   • Each user gets a /24 subnet: 10.8.<subnetOctet>.0/24 (octets 1–253)
//   • Each router gets a host address: 10.8.<subnetOctet>.<routerOctet>/32
//     where routerOctet is 2–254 within that user's /24
//   • Winbox port forwarding: sequential pool starting at 18291 (shared with OVPN)
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Environment ───────────────────────────────────────────────────────────────

const AGENT_URL = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
const VPS_HOST  = process.env.VPS_HOST          || "localhost"
const WG_SERVER_PUBKEY = process.env.WG_SERVER_PUBKEY || ""
// WG_ENDPOINT: raw VPS IP for WireGuard UDP endpoint.
// Must NOT be a domain proxied through Cloudflare — WireGuard UDP won't work through CDN proxies.
const WG_ENDPOINT = process.env.WG_ENDPOINT || VPS_HOST

// ── Constants ─────────────────────────────────────────────────────────────────

const WINBOX_PORT_START  = 18291
const SUBNET_OCTET_MIN   = 1
const SUBNET_OCTET_MAX   = 253
const ROUTER_OCTET_MIN   = 2
const ROUTER_OCTET_MAX   = 254

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TunnelWithPorts {
  id: string
  method: string
  winboxPort: number | null
  subnetOctet: number | null
  routerOctet: number | null
  wgClientPrivKey: string | null
  wgClientPubKey: string | null
  wgServerPubKey: string | null
  vpnAssignedIp: string | null
  vpnUsername: string | null
  ports: { serviceName: string; remotePort: number }[]
}

export interface CreateWireguardTunnelResult {
  clientPrivKey: string   // Fernet-encrypted
  clientPubKey: string    // plaintext base64
  serverPubKey: string    // from env WG_SERVER_PUBKEY
  vpnIp: string           // e.g. "10.8.1.2"
  winboxPort: number      // e.g. 18291
  subnetOctet: number     // e.g. 1
  routerOctet: number     // e.g. 2
}

// ── Key Generation ────────────────────────────────────────────────────────────

/**
 * Generate an X25519 keypair in WireGuard's format (raw 32-byte key, base64).
 *
 * Node.js exports X25519 keys in DER/SubjectPublicKeyInfo or PKCS#8 format.
 * For both public and private keys the actual 32-byte key material is always
 * the last 32 bytes of the DER buffer.
 */
export function generateX25519Keypair(): { privateKey: string; publicKey: string } {
  const { privateKey: privObj, publicKey: pubObj } = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding:  { type: "spki",  format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  })

  // Last 32 bytes are the raw key material in both DER formats
  const privBytes = (privObj as unknown as Buffer).slice(-32)
  const pubBytes  = (pubObj  as unknown as Buffer).slice(-32)

  return {
    privateKey: privBytes.toString("base64"),
    publicKey:  pubBytes.toString("base64"),
  }
}

// ── Fernet Encryption (via health_server) ─────────────────────────────────────

/**
 * Encrypt a plaintext string using Fernet via the Python health_server.
 * Falls back to storing plaintext if the agent is unreachable (dev/offline).
 */
async function encryptSecret(plaintext: string): Promise<string> {
  try {
    const res = await agentFetch(`/encrypt-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: plaintext }),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json() as { encrypted?: string }
      if (data.encrypted) return data.encrypted
    }
  } catch {
    // Agent unreachable in dev — store plaintext; Python decrypt() handles it.
  }
  return plaintext
}

// ── Address Allocation ────────────────────────────────────────────────────────

/**
 * Allocate a (subnetOctet, routerOctet) pair for a new WireGuard tunnel.
 *
 * Strategy:
 *   1. Find all WireGuard tunnels owned by the same user (via router.userId).
 *   2. The user's canonical subnetOctet is the lowest value already in use, or
 *      the next globally free octet if the user has no tunnels yet.
 *   3. Within the user's /24 assign the next free routerOctet (2–254).
 *
 * This gives each user a single /24 (up to 253 routers), and different users
 * get different /24s.  If a user's /24 is full we allocate a second /24.
 */
async function allocateWgAddress(
  routerId: string,
  prisma: PrismaClient,
): Promise<{ subnetOctet: number; routerOctet: number }> {
  // Get the router to find its owner
  const router = await prisma.router.findUnique({
    where: { id: routerId },
    select: { tenantId: true },
  })
  if (!router) throw new Error(`Router ${routerId} not found`)

  // All WireGuard tunnels (across all tenants) — needed for global subnet tracking
  const allWgTunnels = await prisma.tunnel.findMany({
    where: { method: "WIREGUARD" },
    select: {
      subnetOctet: true,
      routerOctet: true,
      router: { select: { tenantId: true } },
    },
  })

  // Map tenantId → set of subnetOctets they already own
  const tenantSubnets = new Map<string, Set<number>>()
  for (const t of allWgTunnels) {
    if (t.subnetOctet === null) continue
    const tid = t.router.tenantId
    if (!tenantSubnets.has(tid)) tenantSubnets.set(tid, new Set())
    tenantSubnets.get(tid)!.add(t.subnetOctet)
  }

  // All globally used subnet octets
  const usedSubnets = new Set(allWgTunnels.map((t) => t.subnetOctet).filter((x): x is number => x !== null))

  // Determine the target tenant's subnet octets (they may own multiple)
  const mySubnets = tenantSubnets.get(router.tenantId) ?? new Set<number>()

  // Build a map: subnetOctet → set of used routerOctets within that subnet
  const subnetRouterOctets = new Map<number, Set<number>>()
  for (const t of allWgTunnels) {
    if (t.subnetOctet === null || t.routerOctet === null) continue
    if (!subnetRouterOctets.has(t.subnetOctet)) subnetRouterOctets.set(t.subnetOctet, new Set())
    subnetRouterOctets.get(t.subnetOctet)!.add(t.routerOctet)
  }

  // Try to fit into one of the user's existing subnets first
  for (const sn of [...mySubnets].sort((a, b) => a - b)) {
    const usedRouterOctets = subnetRouterOctets.get(sn) ?? new Set<number>()
    for (let ro = ROUTER_OCTET_MIN; ro <= ROUTER_OCTET_MAX; ro++) {
      if (!usedRouterOctets.has(ro)) {
        return { subnetOctet: sn, routerOctet: ro }
      }
    }
    // This /24 is full — try the next user subnet
  }

  // Need a new /24 for this user — find the lowest free global subnet octet
  for (let sn = SUBNET_OCTET_MIN; sn <= SUBNET_OCTET_MAX; sn++) {
    if (!usedSubnets.has(sn)) {
      return { subnetOctet: sn, routerOctet: ROUTER_OCTET_MIN }
    }
  }

  throw new Error("WireGuard subnet pool exhausted — no free /24 in 10.8.1.0–10.8.253.0")
}

// ── Winbox Port Allocation ────────────────────────────────────────────────────

/**
 * Allocate the next free Winbox-forwarding port from the shared pool (18291+).
 * The pool is shared between WireGuard and OVPN tunnels.
 */
async function allocateWinboxPort(prisma: PrismaClient): Promise<number> {
  const result = await prisma.tunnel.aggregate({
    where: {
      winboxPort: { not: null },
    },
    _max: { winboxPort: true },
  })

  const maxPort = result._max.winboxPort ?? WINBOX_PORT_START - 1
  return maxPort + 1
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create all credential data needed for a new WireGuard tunnel.
 *
 * Does NOT write to the database — the caller (API route) is responsible for
 * persisting the returned values in the Tunnel row.
 */
export async function createWireguardTunnel(
  routerId: string,
  prismaClient: PrismaClient,
): Promise<CreateWireguardTunnelResult> {
  const { privateKey, publicKey } = generateX25519Keypair()
  const encryptedPrivKey = await encryptSecret(privateKey)

  const [{ subnetOctet, routerOctet }, winboxPort] = await Promise.all([
    allocateWgAddress(routerId, prismaClient),
    allocateWinboxPort(prismaClient),
  ])

  const vpnIp = `10.8.${subnetOctet}.${routerOctet}`

  // Register peer on the WireGuard server (add peer + iptables DNAT for winbox port)
  const res = await agentFetch(`/wg-peer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", pubKey: publicKey, vpnIp, winboxPort }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`health_server /wg-peer add failed: ${text}`)
  }

  return {
    clientPrivKey: encryptedPrivKey,
    clientPubKey:  publicKey,
    serverPubKey:  WG_SERVER_PUBKEY,
    vpnIp,
    winboxPort,
    subnetOctet,
    routerOctet,
  }
}

/**
 * Generate RouterOS 7 CLI commands to set up a WireGuard client tunnel.
 *
 * The script:
 *   - Creates the WireGuard interface with the client private key
 *   - Adds the client's VPN IP address to that interface
 *   - Adds a peer pointing at the VPS server with the server's public key
 *   - Adds a route for 10.8.0.0/8 over the tunnel
 *   - Adds a NAT masquerade rule for traffic going over the tunnel
 *   - Configures port forwarding: VPS:<winboxPort> → router LAN:8291 (Winbox)
 */
export function generateWireguardScript(params: {
  vpsHost: string
  vpnIp: string
  serverPubKey: string
  clientPrivKey: string  // plaintext for display
  winboxPort: number
}): string {
  // Always use WG_ENDPOINT (raw IP) — never the CDN-proxied domain
  const host = WG_ENDPOINT || params.vpsHost || VPS_HOST
  const { vpnIp, serverPubKey, clientPrivKey, winboxPort } = params

  return [
    "# MikroTik AI Agent — WireGuard Tunnel Setup (RouterOS 7)",
    "# Paste these commands into your RouterOS terminal (New Terminal in Winbox)",
    "",
    "# 1. Create WireGuard interface",
    "/interface wireguard",
    `  add name=wg-saas private-key="${clientPrivKey}" listen-port=13231 comment="MikroTik AI Agent"`,
    "",
    "# 2. Assign VPN IP to the interface",
    "/ip address",
    `  add address=${vpnIp}/24 interface=wg-saas`,
    "",
    "# 3. Add server peer",
    "/interface wireguard peers",
    `  add interface=wg-saas \\`,
    `      public-key="${serverPubKey}" \\`,
    `      endpoint-address=${host} \\`,
    `      endpoint-port=51820 \\`,
    `      allowed-address=10.8.0.0/8 \\`,
    `      persistent-keepalive=25 \\`,
    `      comment="MikroTik AI Agent VPS"`,
    "",
    "# 4. Route management traffic over the tunnel",
    "/ip route",
    `  add dst-address=10.8.0.0/8 gateway=wg-saas`,
    "",
    "# 5. Masquerade outbound VPN traffic",
    "/ip firewall nat",
    `  add chain=srcnat out-interface=wg-saas action=masquerade comment="WG-SAAS NAT"`,
    "",
    `# Winbox port forwarding (VPS port ${winboxPort} → this router's Winbox 8291)`,
    "# This is configured server-side — no router action needed.",
    "",
    "# Verify the tunnel (peer should show 'handshake' after ~30 seconds):",
    "/interface wireguard peers print",
  ].join("\n")
}

/**
 * Delete a WireGuard tunnel.
 *
 * For WireGuard, there is no server-side user account to remove — the peer
 * config is managed on the VPS via the agent. We POST to the agent to remove
 * the peer config and the Winbox NAT/port-forward rule.
 */
export async function deleteWireguardTunnel(tunnel: TunnelWithPorts): Promise<void> {
  if (!tunnel.wgClientPubKey) return  // Nothing to clean up

  const res = await agentFetch(`/wg-peer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "delete",
      pubKey: tunnel.wgClientPubKey,
      vpnIp: tunnel.vpnAssignedIp,
      winboxPort: tunnel.winboxPort,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    // Log but do not throw — the tunnel DB record should still be deleted even
    // if the agent is temporarily unreachable.
    console.warn(`[wg-tunnel] agent /wg-peer delete failed: ${text}`)
  }
}
