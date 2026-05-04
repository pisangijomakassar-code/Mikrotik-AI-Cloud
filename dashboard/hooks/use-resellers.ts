"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type {
  CreateResellerInput,
  UpdateResellerInput,
  SaldoOperationInput,
  GenerateVouchersInput,
  PaginatedResult,
} from "@/lib/types"

export interface ResellerData {
  id: string
  name: string
  phone: string
  telegramId: string
  balance: number
  discount: number
  voucherGroup: string
  uplink: string
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  updatedAt: string
  router?: { name: string }
  _count?: { voucherBatches: number }
}

export interface TransactionData {
  id: string
  type: "TOP_UP" | "TOP_DOWN" | "VOUCHER_PURCHASE"
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  hargaVoucher: number
  voucherUsername: string
  voucherPassword: string
  voucherInfo: string
  proofImageUrl: string
  createdAt: string
}

// ── Fetch helpers ──

async function fetchResellers(routerName?: string): Promise<ResellerData[]> {
  const qs = routerName ? `?router=${encodeURIComponent(routerName)}` : ""
  return apiClient.get<ResellerData[]>(`/api/resellers${qs}`)
}

async function fetchReseller(id: string): Promise<ResellerData> {
  return apiClient.get<ResellerData>(`/api/resellers/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchVoucherBatches(resellerId?: string): Promise<Record<string, any>[]> {
  const url = resellerId
    ? `/api/resellers/${resellerId}/vouchers`
    : "/api/vouchers"
  return apiClient.get<Record<string, unknown>[]>(url)
}

async function fetchTransactions(
  resellerId: string,
  page = 1,
  pageSize = 20
) {
  return apiClient.get<PaginatedResult<Record<string, unknown>>>(
    `/api/resellers/${resellerId}/transactions?page=${page}&pageSize=${pageSize}`
  )
}

// ── Queries ──

export function useResellers(routerName?: string) {
  return useQuery<ResellerData[]>({
    queryKey: ["resellers", routerName ?? ""],
    queryFn: () => fetchResellers(routerName),
  })
}

export function useReseller(id: string) {
  return useQuery<ResellerData>({
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

export function useCreateReseller(routerName?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateResellerInput) => {
      return apiClient.post<ResellerData>("/api/resellers", { ...data, routerName })
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
      return apiClient.patch<ResellerData>(`/api/resellers/${id}`, data)
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
      return apiClient.delete(`/api/resellers/${id}`)
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
      return apiClient.post(`/api/resellers/${resellerId}/topup`, data)
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
      return apiClient.post(`/api/resellers/${resellerId}/topdown`, data)
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
      return apiClient.post(`/api/resellers/${resellerId}/vouchers`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-batches"] })
      queryClient.invalidateQueries({ queryKey: ["resellers"] })
      queryClient.invalidateQueries({ queryKey: ["reseller-detail"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}
