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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reseller = Record<string, any>

// ── Fetch helpers ──

async function fetchResellers(): Promise<Reseller[]> {
  return apiClient.get<Reseller[]>("/api/resellers")
}

async function fetchReseller(id: string): Promise<Reseller> {
  return apiClient.get<Reseller>(`/api/resellers/${id}`)
}

async function fetchVoucherBatches(resellerId?: string): Promise<Reseller[]> {
  const url = resellerId
    ? `/api/resellers/${resellerId}/vouchers`
    : "/api/vouchers"
  return apiClient.get<Reseller[]>(url)
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
      return apiClient.post("/api/resellers", data)
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
      return apiClient.patch(`/api/resellers/${id}`, data)
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
