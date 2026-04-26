"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

export interface VoucherTypeData {
  id: string
  namaVoucher: string
  deskripsi: string
  harga: number
  markUp: number
  server: string
  profile: string
  limitUptime: string
  limitQuotaDl: number
  limitQuotaUl: number
  limitQuotaTotal: number
  typeChar: string
  typeLogin: string
  prefix: string
  panjangKarakter: number
  voucherGroup: string
  voucherColor: string
  addressPool: string
  createdAt: string
  updatedAt: string
}

export type VoucherTypeInput = Omit<VoucherTypeData, "id" | "createdAt" | "updatedAt">

export function useVoucherTypes() {
  return useQuery({
    queryKey: ["voucher-types"],
    queryFn: () => apiClient.get<VoucherTypeData[]>("/api/voucher-types"),
  })
}

export function useCreateVoucherType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VoucherTypeInput) => apiClient.post<VoucherTypeData>("/api/voucher-types", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voucher-types"] }),
  })
}

export function useUpdateVoucherType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: VoucherTypeInput & { id: string }) =>
      apiClient.put<VoucherTypeData>(`/api/voucher-types/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voucher-types"] }),
  })
}

export function useDeleteVoucherType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/voucher-types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voucher-types"] }),
  })
}
