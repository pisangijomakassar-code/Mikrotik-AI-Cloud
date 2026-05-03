import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/db-tenant"
import {
  getReseller,
  updateReseller,
  deleteReseller,
} from "@/lib/services/reseller.service"
import type { UpdateResellerInput } from "@/lib/types"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const reseller = await getReseller(id)
    if (!reseller) {
      return Response.json({ error: "Reseller not found" }, { status: 404 })
    }
    return Response.json(reseller)
  } catch (error) {
    console.error("Failed to fetch reseller:", error)
    return Response.json(
      { error: "Failed to fetch reseller" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = (await request.json()) as UpdateResellerInput

    const tgId = body.telegramId?.trim() ?? ""
    if (tgId) {
      if (!/^\-?\d+$/.test(tgId)) {
        return Response.json({ error: "Telegram ID harus berupa angka" }, { status: 400 })
      }
      const db = await getTenantDb()
      const tgDup = await db.reseller.findFirst({ where: { telegramId: tgId, NOT: { id } } })
      if (tgDup) {
        return Response.json({ error: "Telegram ID sudah dipakai oleh reseller lain" }, { status: 400 })
      }
    }

    const reseller = await updateReseller(id, body)
    if (!reseller) {
      return Response.json({ error: "Reseller not found" }, { status: 404 })
    }
    return Response.json(reseller)
  } catch (error) {
    console.error("Failed to update reseller:", error)
    return Response.json(
      { error: "Failed to update reseller" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const reseller = await deleteReseller(id)
    if (!reseller) {
      return Response.json({ error: "Reseller not found" }, { status: 404 })
    }
    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to delete reseller:", error)
    return Response.json(
      { error: "Failed to delete reseller" },
      { status: 500 }
    )
  }
}
