import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { auth } from "@/lib/auth"

const DOCS_MAP: Record<string, string> = {
  "user-guide": "USER_GUIDE.md",
  "api-reference": "API_REFERENCE.md",
  "admin-guide": "ADMIN_GUIDE.md",
}

const ADMIN_ONLY_DOCS = ["admin-guide"]

function findDocsDir(): string {
  // Try multiple paths to handle different deployment scenarios
  const candidates = [
    join(process.cwd(), "docs"),               // Docker volume: /app/docs
    join(process.cwd(), "..", "docs"),          // dev: dashboard/../docs
    join("/app", "docs"),                       // Docker explicit path
    join(process.cwd(), "..", "..", "docs"),    // standalone: .next/standalone/../../docs
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  console.error("[docs] No docs directory found. Tried:", candidates)
  return candidates[0] // fallback
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params

  if (ADMIN_ONLY_DOCS.includes(slug) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const filename = DOCS_MAP[slug]
  if (!filename) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const docsDir = findDocsDir()
  const filePath = join(docsDir, filename)

  try {
    const content = await readFile(filePath, "utf-8")
    return NextResponse.json({ content, filename })
  } catch {
    console.error(`[docs] File not found: ${filePath} (cwd: ${process.cwd()})`)
    return NextResponse.json(
      { error: `Documentation file not found. Looked in: ${docsDir}` },
      { status: 404 }
    )
  }
}
