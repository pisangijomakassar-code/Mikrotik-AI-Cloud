import { prisma } from "../db"
import { auth } from "../auth"
import { getTenantDb } from "../db-tenant"
import type {
  CreateResellerInput,
  UpdateResellerInput,
  SaldoOperationInput,
  VoucherFilter,
  PaginatedResult,
} from "../types"

// ── Reseller CRUD ──
//
// Resellers are scoped per Tenant (via getTenantDb extension), filterable
// per Router (1 router → N resellers; 1 reseller = 1 router).

async function requireTenantId(): Promise<string> {
  const session = await auth()
  const tenantId = session?.user?.tenantId
  if (!tenantId) throw new Error("No tenant context")
  return tenantId
}

export async function listResellers(routerId?: string) {
  const db = await getTenantDb()
  return db.reseller.findMany({
    where: { ...(routerId ? { routerId } : {}) },
    include: { _count: { select: { voucherBatches: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function getReseller(resellerId: string) {
  const db = await getTenantDb()
  return db.reseller.findFirst({
    where: { id: resellerId },
    include: { _count: { select: { voucherBatches: true, transactions: true } }, router: { select: { name: true } } },
  })
}

export async function createReseller(routerId: string, data: CreateResellerInput) {
  const db = await getTenantDb()
  const tenantId = await requireTenantId()
  return db.reseller.create({
    data: {
      tenantId,
      name: data.name,
      phone: data.phone ?? "",
      telegramId: data.telegramId ?? "",
      balance: data.balance ?? 0,
      discount: data.discount ?? 0,
      voucherGroup: data.voucherGroup ?? "default",
      uplink: data.uplink ?? "",
      routerId,
    },
  })
}

export async function updateReseller(resellerId: string, data: UpdateResellerInput) {
  const db = await getTenantDb()
  const existing = await db.reseller.findFirst({ where: { id: resellerId } })
  if (!existing) return null
  return db.reseller.update({ where: { id: resellerId }, data })
}

export async function deleteReseller(resellerId: string) {
  const db = await getTenantDb()
  const existing = await db.reseller.findFirst({ where: { id: resellerId } })
  if (!existing) return null
  return db.reseller.delete({ where: { id: resellerId } })
}

// ── Saldo Operations (atomic via $transaction) ──
//
// $transaction callback dapat raw Prisma client (tanpa extension). Untuk
// menjaga tenant safety, kita verify ownership dulu via getTenantDb()
// sebelum transaction. Inside transaction, query by resellerId (unique)
// + tenant filter eksplisit.

export async function topUpSaldo(resellerId: string, input: SaldoOperationInput) {
  const tenantId = await requireTenantId()
  const db = await getTenantDb()

  // Pre-check: pastikan reseller milik tenant ini
  const exists = await db.reseller.findFirst({ where: { id: resellerId } })
  if (!exists) throw new Error("Reseller not found")

  return prisma.$transaction(async (tx) => {
    const reseller = await tx.reseller.findFirst({
      where: { id: resellerId, tenantId },
    })
    if (!reseller) throw new Error("Reseller not found")

    const balanceBefore = reseller.balance
    const balanceAfter = balanceBefore + input.amount

    await tx.reseller.update({
      where: { id: resellerId },
      data: { balance: balanceAfter },
    })

    return tx.saldoTransaction.create({
      data: {
        resellerId,
        type: "TOP_UP",
        amount: input.amount,
        balanceBefore,
        balanceAfter,
        description: input.description ?? `Top up Rp ${input.amount.toLocaleString("id-ID")}`,
        proofImageUrl: input.proofImageUrl ?? "",
      },
    })
  })
}

export async function topDownSaldo(resellerId: string, input: SaldoOperationInput) {
  const tenantId = await requireTenantId()
  const db = await getTenantDb()

  const exists = await db.reseller.findFirst({ where: { id: resellerId } })
  if (!exists) throw new Error("Reseller not found")

  return prisma.$transaction(async (tx) => {
    const reseller = await tx.reseller.findFirst({
      where: { id: resellerId, tenantId },
    })
    if (!reseller) throw new Error("Reseller not found")
    if (reseller.balance < input.amount) throw new Error("Saldo tidak mencukupi")

    const balanceBefore = reseller.balance
    const balanceAfter = balanceBefore - input.amount

    await tx.reseller.update({
      where: { id: resellerId },
      data: { balance: balanceAfter },
    })

    return tx.saldoTransaction.create({
      data: {
        resellerId,
        type: "TOP_DOWN",
        amount: input.amount,
        balanceBefore,
        balanceAfter,
        description: input.description ?? `Top down Rp ${input.amount.toLocaleString("id-ID")}`,
      },
    })
  })
}

// ── Transaction History ──

export async function listTransactions(resellerId: string, page = 1, pageSize = 20) {
  const db = await getTenantDb()
  const reseller = await db.reseller.findFirst({ where: { id: resellerId } })
  if (!reseller) return null

  const [data, total] = await Promise.all([
    prisma.saldoTransaction.findMany({
      where: { resellerId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.saldoTransaction.count({ where: { resellerId } }),
  ])

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ── Voucher Batches ──

export async function listVoucherBatches(filter?: VoucherFilter) {
  const db = await getTenantDb()
  const page = filter?.page ?? 1
  const pageSize = filter?.pageSize ?? 20

  const where: Record<string, unknown> = {}
  if (filter?.routerName) where.routerName = filter.routerName
  if (filter?.resellerId) where.resellerId = filter.resellerId
  if (filter?.source) where.source = filter.source
  if (filter?.from || filter?.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    }
  }

  const [data, total] = await Promise.all([
    db.voucherBatch.findMany({
      where,
      include: { reseller: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.voucherBatch.count({ where }),
  ])

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getVoucherBatch(batchId: string) {
  const db = await getTenantDb()
  return db.voucherBatch.findFirst({ where: { id: batchId } })
}
