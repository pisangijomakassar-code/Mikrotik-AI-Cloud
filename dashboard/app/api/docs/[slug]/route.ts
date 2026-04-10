import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const DOCS_MAP: Record<string, string> = {
  "user-guide": "USER_GUIDE.md",
  "api-reference": "API_REFERENCE.md",
  "admin-guide": "ADMIN_GUIDE.md",
}

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
  const { slug } = await params

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
