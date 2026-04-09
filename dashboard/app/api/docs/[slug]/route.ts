import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

const DOCS_MAP: Record<string, string> = {
  "user-guide": "USER_GUIDE.md",
  "api-reference": "API_REFERENCE.md",
  "admin-guide": "ADMIN_GUIDE.md",
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

  const filePath = join(process.cwd(), "..", "docs", filename)

  try {
    const content = await readFile(filePath, "utf-8")
    return NextResponse.json({ content, filename })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
