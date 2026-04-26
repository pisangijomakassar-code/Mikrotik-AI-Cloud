import { auth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("image") as File | null

    if (!file) {
      return Response.json({ error: "No image provided" }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return Response.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      )
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "Image must be smaller than 10MB" },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const ext = file.name.split(".").pop() || "png"
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    // Save to public/uploads
    const uploadDir = join(process.cwd(), "public", "uploads")
    await mkdir(uploadDir, { recursive: true })
    await writeFile(join(uploadDir, filename), buffer)

    return Response.json({ url: `/uploads/${filename}` })
  } catch (error) {
    console.error("Upload error:", error)
    return Response.json(
      { error: "Failed to upload image" },
      { status: 500 }
    )
  }
}
