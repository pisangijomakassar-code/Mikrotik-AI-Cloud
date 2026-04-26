import { type NextRequest } from "next/server"
import fs from "fs/promises"
import path from "path"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Resolve script directory relative to project root so it works
// inside Docker regardless of __dirname/cwd quirks.
const SCRIPTS_DIR = path.join(process.cwd(), "scripts")

interface ScriptConfig {
  file: string
  ext: string
  contentType: string
}

const SCRIPT_MAP: Record<string, ScriptConfig> = {
  cloudflare: { file: "cloudflared-ros7.rsc", ext: "rsc",  contentType: "text/plain" },
  sstp:       { file: "sstp-ros6.rsc",        ext: "rsc",  contentType: "text/plain" },
  linux:      { file: "install-cloudflared.sh", ext: "sh", contentType: "application/octet-stream" },
}

// GET /api/tunnels/[routerId]/script?type=cloudflare|sstp|linux
// Returns a personalised installation script with credentials injected.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routerId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { routerId } = await params
  const type = request.nextUrl.searchParams.get("type") ?? "cloudflare"

  const scriptConfig = SCRIPT_MAP[type]
  if (!scriptConfig) {
    return Response.json(
      { error: `Unknown script type "${type}". Use: cloudflare, sstp, linux` },
      { status: 400 }
    )
  }

  try {
    // Verify ownership and fetch tunnel + router
    const tunnel = await prisma.tunnel.findFirst({
      where: {
        routerId,
        router: { userId: session.user.id },
      },
      include: {
        router: { select: { name: true } },
      },
    })

    if (!tunnel) {
      return Response.json({ error: "Tunnel not found" }, { status: 404 })
    }

    // Read script template
    const scriptPath = path.join(SCRIPTS_DIR, scriptConfig.file)
    let script: string
    try {
      script = await fs.readFile(scriptPath, "utf-8")
    } catch {
      return Response.json(
        { error: `Script template not found: ${scriptConfig.file}` },
        { status: 500 }
      )
    }

    // Replace placeholders
    const vpnHost = process.env.SSTP_SERVER_HOST ?? ""
    script = script
      .replaceAll("__TOKEN__",     tunnel.cloudflareTunnelToken ?? "")
      .replaceAll("__ROUTER_ID__", routerId)
      .replaceAll("__VPN_HOST__",  vpnHost)
      .replaceAll("__VPN_USER__",  tunnel.vpnUsername ?? "")
      .replaceAll("__VPN_PASS__",  tunnel.vpnPassword ?? "")

    // Sanitise router name for use in a filename
    const safeName = (tunnel.router?.name ?? routerId)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .toLowerCase()

    const filename = `setup-${safeName}.${scriptConfig.ext}`

    return new Response(script, {
      headers: {
        "Content-Type": scriptConfig.contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Failed to generate tunnel script:", error)
    return Response.json(
      { error: "Failed to generate tunnel script" },
      { status: 500 }
    )
  }
}
