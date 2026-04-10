"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  CreateResellerInput,
  UpdateResellerInput,
  SaldoOperationInput,
  GenerateVouchersInput,
  PaginatedResult,
} from "@/lib/types"

// ── Fetch helpers ──

async function fetchResellers() {
  const res = await fetch("/api/resellers")
  if (!res.ok) throw new Error("Failed to fetch resellers")
  return res.json()
}

async function fetchReseller(id: string) {
  const res = await fetch(`/api/resellers/${id}`)
  if (!res.ok) throw new Error("Failed to fetch reseller")
  return res.json()
}

async function fetchVoucherBatches(resellerId?: string) {
  const url = resellerId
    ? `/api/resellers/${resellerId}/vouchers`
    : "/api/vouchers"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch voucher batches")
  return res.json()
}

async function fetchTransactions(
  resellerId: string,
  page = 1,
  pageSize = 20
) {
  const res = await fetch(
    `/api/resellers/${resellerId}/transactions?page=${page}&pageSize=${pageSize}`
  )
  if (!res.ok) throw new Error("Failed to fetch transactions")
  return res.json()
}

// ── Queries ──

export function useResellers() {
  return useQuery({
    queryKey: ["resellers"],
    queryFn: fetchResellers,
  })
}

export function useReseller(id: string) {
  return useQuery({
    queryKey: ["reseller-detail", id],
    queryFn: () => fetchReseller(id),
    enabled: !!id,
  })
}

export function useVoucherBatches(resellerId?: string) {
  return useQuery({
    queryKey: ["voucher-batches", resellerId],
    queryFn: () => fetchVoucherBatches(resellerId),
  })
}

export function useTransactions(
  resellerId: string,
  page = 1,
  pageSize = 20
) {
  return useQuery<PaginatedResult<Record<string, unknown>>>({
    queryKey: ["transactions", resellerId, page, pageSize],
    queryFn: () => fetchTransactions(resellerId, page, pageSize),
    enabled: !!resellerId,
  })
}

// ── Mutations ──

export function useCreateReseller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateResellerInput) => {
      const res = await fetch("/api/resellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create reseller" }))
        throw new Error(err.error || "Failed to create reseller")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
    },
  })
}

export function useUpdateReseller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: UpdateResellerInput
    }) => {
      const res = await fetch(`/api/resellers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update reseller" }))
        throw new Error(err.error || "Failed to update reseller")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["reseller-detail"] })
    },
  })
}

export function useDeleteReseller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/resellers/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete reseller" }))
        throw new Error(err.error || "Failed to delete reseller")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
    },
  })
}

export function useTopUpSaldo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      resellerId,
      data,
    }: {
      resellerId: string
      data: SaldoOperationInput
    }) => {
      const res = await fetch(`/api/resellers/${resellerId}/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to top up saldo" }))
        throw new Error(err.error || "Failed to top up saldo")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["reseller-detail"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useTopDownSaldo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      resellerId,
      data,
    }: {
      resellerId: string
      data: SaldoOperationInput
    }) => {
      const res = await fetch(`/api/resellers/${resellerId}/topdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to deduct saldo" }))
        throw new Error(err.error || "Failed to deduct saldo")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["reseller-detail"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useGenerateVouchers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      resellerId,
      data,
    }: {
      resellerId: string
      data: GenerateVouchersInput
    }) => {
      const res = await fetch(`/api/resellers/${resellerId}/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate vouchers" }))
        throw new Error(err.error || "Failed to generate vouchers")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-batches"] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["reseller-detail"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}
