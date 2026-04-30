import { auth } from "@/lib/auth"

const AGENT_URL = process.env.AGENT_HEALTH_URL || "http://mikrotik-agent:8080"

// GET /api/tunnels/ovpn-ca
// Proxy the CA certificate from the OpenVPN container via the agent.
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const res = await fetch(`${AGENT_URL}/ovpn-ca`, {
    signal: AbortSignal.timeout(10000),
  }).catch((e: unknown) => {
    throw new Error(`Agent unreachable: ${e instanceof Error ? e.message : String(e)}`)
  })

  if (!res.ok) {
    return new Response(`CA cert not available: ${await res.text()}`, { status: 502 })
  }

  const cert = await res.text()
  return new Response(cert, {
    headers: {
      "Content-Type": "application/x-pem-file",
      "Content-Disposition": 'attachment; filename="ca.crt"',
    },
  })
}
