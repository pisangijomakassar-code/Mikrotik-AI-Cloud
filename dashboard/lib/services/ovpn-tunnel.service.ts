import * as crypto from "crypto"
import type { PrismaClient } from "@/app/generated/prisma/client"

// ── Architecture Note ─────────────────────────────────────────────────────────
//
// OpenVPN runs on the VPS host. The Python health_server manages user creation
// via its /ovpn-user endpoint, which calls the OpenVPN management socket or
// scripts as needed. RouterOS 6 is the target platform (TCP mode, AES-256-CBC,
// SHA1 — these are the cipher/auth values RouterOS 6 OVPN client supports).
//
// Network layout:
//   • 10.9.0.0/16  — OVPN address space (separate from WG's 10.8.0.0/16)
//   • Each user gets a /24 subnet: 10.9.<subnetOctet>.0/24 (octets 1–253)
//   • Each router gets a host address: 10.9.<subnetOctet>.<routerOctet>/32
//     where routerOctet is 2–254 within that user's /24
//   • Winbox port forwarding: sequential pool starting at 18291 (shared with WG)
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Environment ───────────────────────────────────────────────────────────────

const AGENT_URL  = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"
const VPS_HOST   = process.env.VPS_HOST         || "localhost"
const OVPN_PORT  = process.env.OVPN_PORT        || "1194"

// ── Constants ─────────────────────────────────────────────────────────────────

const WINBOX_PORT_START = 18291
const SUBNET_OCTET_MIN  = 1
const SUBNET_OCTET_MAX  = 253
const ROUTER_OCTET_MIN  = 2
const ROUTER_OCTET_MAX  = 254

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TunnelWithPorts {
  id: string
  method: string
  winboxPort: number | null
  subnetOctet: number | null
  routerOctet: number | null
  vpnUsername: string | null
  vpnPassword: string | null
  wgClientPrivKey: string | null
  wgClientPubKey: string | null
  wgServerPubKey: string | null
  ports: { serviceName: string; remotePort: number }[]
}

export interface CreateOvpnTunnelResult {
  username: string
  password: string      // Fernet-encrypted
  vpnIp: string         // e.g. "10.9.1.2"
  winboxPort: number    // e.g. 18292
  subnetOctet: number
  routerOctet: number
}

// ── Credential Generation ─────────────────────────────────────────────────────

/**
 * Generate OVPN credentials for a router.
 *
 * Username format: "mt-{first 8 chars of routerId}-{4 random hex chars}"
 * Password: 16 random alphanumeric characters
 */
export function generateOvpnCredentials(routerId: string): { username: string; password: string } {
  const prefix   = routerId.slice(0, 8)
  const suffix   = crypto.randomBytes(2).toString("hex")   // 4 hex chars
  const username = `mt-${prefix}-${suffix}`

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes    = crypto.randomBytes(16)
  const password = Array.from(bytes)
    .map((b) => alphabet[(b as number) % alphabet.length])
    .join("")

  return { username, password }
}

// ── Fernet Encryption (via health_server) ─────────────────────────────────────

/**
 * Encrypt a plaintext string using Fernet via the Python health_server.
 * Falls back to storing plaintext if the agent is unreachable (dev/offline).
 */
async function encryptSecret(plaintext: string): Promise<string> {
  try {
    const res = await fetch(`${AGENT_URL}/encrypt-password`, {
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
 * Allocate a (subnetOctet, routerOctet) pair for a new OVPN tunnel.
 *
 * Strategy mirrors wg-tunnel.service.ts but operates on the 10.9.0.0/16
 * address space and only considers OVPN tunnels.
 *
 *   1. Find all OVPN tunnels owned by the same user (via router.userId).
 *   2. The user's canonical subnetOctet is the lowest value already in use, or
 *      the next globally free octet if the user has no tunnels yet.
 *   3. Within the user's /24 assign the next free routerOctet (2–254).
 */
async function allocateOvpnAddress(
  routerId: string,
  prisma: PrismaClient,
): Promise<{ subnetOctet: number; routerOctet: number }> {
  const router = await prisma.router.findUnique({
    where: { id: routerId },
    select: { userId: true },
  })
  if (!router) throw new Error(`Router ${routerId} not found`)

  const allOvpnTunnels = await prisma.tunnel.findMany({
    where: { method: "OVPN" },
    select: {
      subnetOctet: true,
      routerOctet: true,
      router: { select: { userId: true } },
    },
  })

  // Map userId → set of subnetOctets they already own in the OVPN space
  const userSubnets = new Map<string, Set<number>>()
  for (const t of allOvpnTunnels) {
    if (t.subnetOctet === null) continue
    const uid = t.router.userId
    if (!userSubnets.has(uid)) userSubnets.set(uid, new Set())
    userSubnets.get(uid)!.add(t.subnetOctet)
  }

  // All globally used OVPN subnet octets
  const usedSubnets = new Set(
    allOvpnTunnels.map((t) => t.subnetOctet).filter((x): x is number => x !== null),
  )

  const mySubnets = userSubnets.get(router.userId) ?? new Set<number>()

  // Build map: subnetOctet → set of used routerOctets
  const subnetRouterOctets = new Map<number, Set<number>>()
  for (const t of allOvpnTunnels) {
    if (t.subnetOctet === null || t.routerOctet === null) continue
    if (!subnetRouterOctets.has(t.subnetOctet)) subnetRouterOctets.set(t.subnetOctet, new Set())
    subnetRouterOctets.get(t.subnetOctet)!.add(t.routerOctet)
  }

  // Fit into an existing user subnet first
  for (const sn of [...mySubnets].sort((a, b) => a - b)) {
    const usedRouterOctets = subnetRouterOctets.get(sn) ?? new Set<number>()
    for (let ro = ROUTER_OCTET_MIN; ro <= ROUTER_OCTET_MAX; ro++) {
      if (!usedRouterOctets.has(ro)) {
        return { subnetOctet: sn, routerOctet: ro }
      }
    }
  }

  // Need a new /24 — find the lowest free global subnet octet in OVPN space
  for (let sn = SUBNET_OCTET_MIN; sn <= SUBNET_OCTET_MAX; sn++) {
    if (!usedSubnets.has(sn)) {
      return { subnetOctet: sn, routerOctet: ROUTER_OCTET_MIN }
    }
  }

  throw new Error("OVPN subnet pool exhausted — no free /24 in 10.9.1.0–10.9.253.0")
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
 * Create all credential data needed for a new OpenVPN tunnel.
 *
 * Steps:
 *   1. Generate unique OVPN credentials (username + plaintext password).
 *   2. Allocate a free 10.9.X.Y address and a Winbox forwarding port.
 *   3. POST to the Python health_server's /ovpn-user endpoint so it can create
 *      the OpenVPN user on the VPS.
 *   4. Fernet-encrypt the password.
 *
 * Does NOT write to the database — the caller (API route) is responsible for
 * persisting the returned values in the Tunnel row.
 */
export async function createOvpnTunnel(
  routerId: string,
  prismaClient: PrismaClient,
): Promise<CreateOvpnTunnelResult> {
  const { username, password } = generateOvpnCredentials(routerId)

  const [{ subnetOctet, routerOctet }, winboxPort] = await Promise.all([
    allocateOvpnAddress(routerId, prismaClient),
    allocateWinboxPort(prismaClient),
  ])

  const vpnIp = `10.9.${subnetOctet}.${routerOctet}`

  // Register the user with the OpenVPN server via the agent
  const res = await fetch(`${AGENT_URL}/ovpn-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", username, password, vpnIp }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`health_server /ovpn-user create failed: ${text}`)
  }

  const encryptedPassword = await encryptSecret(password)

  return {
    username,
    password: encryptedPassword,
    vpnIp,
    winboxPort,
    subnetOctet,
    routerOctet,
  }
}

/**
 * Generate RouterOS 6 CLI commands to set up an OpenVPN client tunnel.
 *
 * RouterOS 6 OVPN client supports: TCP transport, AES-256-CBC cipher, SHA1 auth.
 *
 * The script:
 *   - Creates the OVPN client interface with supplied credentials
 *   - Adds the VPN IP address to the interface
 *   - Adds a route for the management subnet (10.9.0.0/8) over the tunnel
 */
export function generateOvpnScript(params: {
  vpsHost: string
  vpnIp: string
  ovpnHost: string      // VPS host for OVPN server
  username: string
  password: string      // plaintext for display
  winboxPort: number
}): string {
  const host     = params.ovpnHost || params.vpsHost || VPS_HOST
  const port     = OVPN_PORT
  const { vpnIp, username, password, winboxPort } = params

  return [
    "# MikroTik AI Agent — OpenVPN Tunnel Setup (RouterOS 6)",
    "# Paste into RouterOS Terminal (Winbox → New Terminal)",
    "",
    "# 1. Import CA cert terlebih dahulu (upload ca.crt via Winbox Files)",
    "# /certificate import file-name=ca.crt",
    "",
    "# 2. Tambahkan OVPN client interface",
    "/interface ovpn-client",
    `  add name=ovpn-saas \\`,
    `      connect-to=${host} \\`,
    `      port=${port} \\`,
    `      mode=ip \\`,
    `      user=${username} \\`,
    `      password=${password} \\`,
    `      profile=default-encryption \\`,
    `      certificate=ca.crt_0 \\`,
    `      auth=sha1 \\`,
    `      cipher=aes256 \\`,
    `      disabled=no \\`,
    `      comment="MikroTik AI Agent Tunnel"`,
    "",
    "# IP dan route diterima otomatis dari server — tidak perlu setting manual.",
    "",
    "# Cek status (harus muncul 'R' = Running setelah ~10 detik):",
    "/interface ovpn-client print",
  ].join("\n")
}

/**
 * Delete an OVPN tunnel.
 *
 * Posts a delete action to the agent to remove the OpenVPN user from the
 * server and clean up the Winbox NAT/port-forward rule.
 */
export async function deleteOvpnTunnel(
  tunnel: TunnelWithPorts,
  username: string,
): Promise<void> {
  const res = await fetch(`${AGENT_URL}/ovpn-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "delete",
      username,
      winboxPort: tunnel.winboxPort,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    // Log but do not throw — the tunnel DB record should still be deleted even
    // if the agent is temporarily unreachable.
    console.warn(`[ovpn-tunnel] agent /ovpn-user delete failed: ${text}`)
  }
}
