"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

export interface VoucherProfileSetting {
  id: string
  profileName: string
  price: number
  charType: string
  charLength: number
  loginType: string
  limitUptime: string | null
  limitQuota: string | null
  qrColor: string
}

export function useVoucherProfileSettings() {
  return useQuery<VoucherProfileSetting[]>({
    queryKey: ["voucher-profile-settings"],
    queryFn: () => apiClient.get("/api/voucher-profiles"),
  })
}

export function useSaveVoucherProfileSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<VoucherProfileSetting> & { profileName: string }) =>
      apiClient.post("/api/voucher-profiles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voucher-profile-settings"] })
    },
  })
}
