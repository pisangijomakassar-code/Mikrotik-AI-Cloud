import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { agentFetch } from "@/lib/agent-fetch"

const WG_SERVER_PUBKEY = process.env.WG_SERVER_PUBKEY || ""
const VPS_HOST = process.env.VPS_HOST || ""
const WG_PORT = 51820

// Assign IP di subnet 10.8.0.x (10.8.0.1 = server, .2–.254 = admin PCs)
async function assignVpnIp(): Promise<string> {
  const peers = await prisma.user.findMany({
    where: { wgVpnIp: { not: "" } },
    select: { wgVpnIp: true },
  })
  const used = new Set(peers.map((p) => p.wgVpnIp))
  for (let i = 2; i <= 254; i++) {
    const ip = `10.8.0.${i}`
    if (!used.has(ip)) return ip
  }
  throw new Error("Tidak ada IP tersedia di subnet admin VPN (10.8.0.x)")
}

// GET — status VPN user saat ini
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { wgPubKey: true, wgVpnIp: true },
  })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  // Ambil daftar router tenant untuk ditampilkan ke user
  const routers = session.user.tenantId
    ? await prisma.router.findMany({
        where: { tenantId: session.user.tenantId },
        select: { name: true, label: true, host: true, connectionMethod: true },
      })
    : []

  return Response.json({
    provisioned: !!user.wgPubKey,
    vpnIp: user.wgVpnIp || null,
    routers,
  })
}

// POST — provision peer baru (generate keypair di agent, simpan ke DB)
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { wgPubKey: true, wgVpnIp: true },
  })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  // Sudah punya VPN — return config yang ada
  if (user.wgPubKey && user.wgVpnIp) {
    return Response.json({ alreadyProvisioned: true, vpnIp: user.wgVpnIp })
  }

  // Generate keypair via agent
  const genRes = await agentFetch("/generate-wg-keypair", { method: "POST" })
  if (!genRes.ok) return Response.json({ error: "Gagal generate keypair" }, { status: 502 })
  const { privateKey, publicKey } = await genRes.json() as { privateKey: string; publicKey: string }

  const vpnIp = await assignVpnIp()

  // Register peer di WireGuard server
  const peerRes = await agentFetch("/wg-peer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", pubKey: publicKey, vpnIp }),
  })
  if (!peerRes.ok) {
    const err = await peerRes.json().catch(() => ({})) as { error?: string }
    return Response.json({ error: err.error ?? "Gagal register peer WireGuard" }, { status: 502 })
  }

  // Simpan ke DB
  await prisma.user.update({
    where: { id: session.user.id },
    data: { wgPubKey: publicKey, wgVpnIp: vpnIp },
  })

  // Build client config
  const tunnels = session.user.tenantId
    ? await prisma.router.findMany({
        where: { tenantId: session.user.tenantId },
        select: { name: true, host: true },
      })
    : []

  const routerComments = tunnels.length
    ? "\n# Router kamu:\n" + tunnels.map((r) => `# ${r.name} → Winbox: ${r.host}`).join("\n")
    : ""

  const conf = `[Interface]
PrivateKey = ${privateKey}
Address = ${vpnIp}/32
DNS = 1.1.1.1
${routerComments}

[Peer]
# MikroTik AI VPS
PublicKey = ${WG_SERVER_PUBKEY}
Endpoint = ${VPS_HOST}:${WG_PORT}
AllowedIPs = 10.8.0.0/16
PersistentKeepalive = 25
`

  return Response.json({ provisioned: true, vpnIp, conf })
}

// DELETE — hapus peer
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { wgPubKey: true, wgVpnIp: true },
  })
  if (!user?.wgPubKey) return Response.json({ ok: true, message: "Tidak ada peer untuk dihapus" })

  await agentFetch("/wg-peer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", pubKey: user.wgPubKey, vpnIp: user.wgVpnIp }),
  }).catch(() => null)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { wgPubKey: "", wgVpnIp: "" },
  })

  return Response.json({ ok: true })
}
