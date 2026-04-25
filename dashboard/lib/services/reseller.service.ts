import { prisma } from "../db"
import type {
  CreateResellerInput,
  UpdateResellerInput,
  SaldoOperationInput,
  VoucherFilter,
  PaginatedResult,
} from "../types"

// ── Reseller CRUD ──

export async function listResellers(userId: string) {
  return prisma.reseller.findMany({
    where: { userId },
    include: { _count: { select: { voucherBatches: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function getReseller(resellerId: string, userId: string) {
  const reseller = await prisma.reseller.findUnique({
    where: { id: resellerId },
    include: { _count: { select: { voucherBatches: true, transactions: true } } },
  })
  if (!reseller || reseller.userId !== userId) return null
  return reseller
}

export async function createReseller(userId: string, data: CreateResellerInput) {
  return prisma.reseller.create({
    data: {
      name: data.name,
      phone: data.phone ?? "",
      telegramId: data.telegramId ?? "",
      balance: data.balance ?? 0,
      discount: data.discount ?? 0,
      voucherGroup: data.voucherGroup ?? "default",
      uplink: data.uplink ?? "",
      userId,
    },
  })
}

export async function updateReseller(
  resellerId: string,
  userId: string,
  data: UpdateResellerInput,
) {
  const existing = await prisma.reseller.findUnique({ where: { id: resellerId } })
  if (!existing || existing.userId !== userId) return null
  return prisma.reseller.update({ where: { id: resellerId }, data })
}

export async function deleteReseller(resellerId: string, userId: string) {
  const existing = await prisma.reseller.findUnique({ where: { id: resellerId } })
  if (!existing || existing.userId !== userId) return null
  return prisma.reseller.delete({ where: { id: resellerId } })
}

// ── Saldo Operations (atomic via $transaction) ──

export async function topUpSaldo(
  resellerId: string,
  userId: string,
  input: SaldoOperationInput,
) {
  return prisma.$transaction(async (tx) => {
    const reseller = await tx.reseller.findUnique({ where: { id: resellerId } })
    if (!reseller || reseller.userId !== userId) {
      throw new Error("Reseller not found")
    }

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

export async function topDownSaldo(
  resellerId: string,
  userId: string,
  input: SaldoOperationInput,
) {
  return prisma.$transaction(async (tx) => {
    const reseller = await tx.reseller.findUnique({ where: { id: resellerId } })
    if (!reseller || reseller.userId !== userId) {
      throw new Error("Reseller not found")
    }
    if (reseller.balance < input.amount) {
      throw new Error("Saldo tidak mencukupi")
    }

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

export async function listTransactions(
  resellerId: string,
  userId: string,
  page = 1,
  pageSize = 20,
) {
  const reseller = await prisma.reseller.findUnique({ where: { id: resellerId } })
  if (!reseller || reseller.userId !== userId) return null

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
  } satisfies PaginatedResult<typeof data[number]>
}

// ── Voucher Batches ──

export async function listVoucherBatches(
  userId: string,
  filter?: VoucherFilter,
) {
  const page = filter?.page ?? 1
  const pageSize = filter?.pageSize ?? 20

  const where: Record<string, unknown> = { userId }
  if (filter?.resellerId) where.resellerId = filter.resellerId
  if (filter?.source) where.source = filter.source
  if (filter?.from || filter?.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    }
  }

  const [data, total] = await Promise.all([
    prisma.voucherBatch.findMany({
      where,
      include: { reseller: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.voucherBatch.count({ where }),
  ])

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  } satisfies PaginatedResult<typeof data[number]>
}

export async function getVoucherBatch(batchId: string, userId: string) {
  const batch = await prisma.voucherBatch.findUnique({ where: { id: batchId } })
  if (!batch || batch.userId !== userId) return null
  return batch
}
