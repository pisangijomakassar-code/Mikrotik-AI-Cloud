import { auth } from "@/lib/auth"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

function findConfigDir(): string {
  const candidates = [
    join(process.cwd(), "..", "config"),
    join(process.cwd(), "config"),
    join("/app", "config"),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  return candidates[0]
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8")
  } catch {
    return null
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const configDir = findConfigDir()

  const [configRaw, soulMd, heartbeatMd] = await Promise.all([
    readTextFile(join(configDir, "config.json")),
    readTextFile(join(configDir, "SOUL.md")),
    readTextFile(join(configDir, "HEARTBEAT.md")),
  ])

  // Also try to read generated config
  const generatedRaw = await readTextFile(join(configDir, "config.generated.json"))

  let config: Record<string, unknown> = {}
  try {
    config = JSON.parse(configRaw ?? "{}")
  } catch { /* ignore */ }

  let generatedConfig: Record<string, unknown> | null = null
  try {
    if (generatedRaw) generatedConfig = JSON.parse(generatedRaw)
  } catch { /* ignore */ }

  // Extract key settings
  const agents = (config.agents as Record<string, unknown>) ?? {}
  const defaults = (agents.defaults as Record<string, unknown>) ?? {}
  const providers = (config.providers as Record<string, unknown>) ?? {}
  const channels = (config.channels as Record<string, unknown>) ?? {}
  const telegram = (channels.telegram as Record<string, unknown>) ?? {}
  const tools = (config.tools as Record<string, unknown>) ?? {}
  const mcpServers = (tools.mcpServers as Record<string, unknown>) ?? {}

  // Get allowFrom from generated config if available
  const activeConfig = generatedConfig ?? config
  const activeChannels = (activeConfig.channels as Record<string, unknown>) ?? {}
  const activeTelegram = (activeChannels.telegram as Record<string, unknown>) ?? {}

  return Response.json({
    agent: {
      model: (defaults.model as string) ?? "",
      provider: (defaults.provider as string) ?? "",
    },
    providers: Object.keys(providers),
    telegram: {
      enabled: (telegram.enabled as boolean) ?? false,
      allowFrom: (activeTelegram.allowFrom as string[]) ?? [],
    },
    mcpServers: Object.keys(mcpServers),
    soul: soulMd,
    heartbeat: heartbeatMd,
    configDir,
  })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { field, value } = body as { field: string; value: string }

  if (!field || value === undefined) {
    return Response.json({ error: "field and value required" }, { status: 400 })
  }

  const configDir = findConfigDir()

  try {
    switch (field) {
      case "model": {
        const configPath = join(configDir, "config.json")
        const raw = await readFile(configPath, "utf-8")
        const config = JSON.parse(raw)
        if (!config.agents) config.agents = {}
        if (!config.agents.defaults) config.agents.defaults = {}
        config.agents.defaults.model = value
        await writeFile(configPath, JSON.stringify(config, null, 2))
        return Response.json({ success: true, field, value })
      }
      case "soul": {
        await writeFile(join(configDir, "SOUL.md"), value)
        return Response.json({ success: true, field })
      }
      case "heartbeat": {
        await writeFile(join(configDir, "HEARTBEAT.md"), value)
        return Response.json({ success: true, field })
      }
      default:
        return Response.json({ error: `Unknown field: ${field}` }, { status: 400 })
    }
  } catch (err) {
    console.error("Settings update failed:", err)
    return Response.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
