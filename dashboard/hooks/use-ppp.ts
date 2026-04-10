"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

// --- Queries ---

async function fetchPPPSecrets(router?: string): Promise<AnyRecord[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<AnyRecord>(`/api/ppp/secrets${qs}`)
  return (data.secrets ?? data) as AnyRecord[]
}

async function fetchPPPActive(router?: string): Promise<AnyRecord[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<AnyRecord>(`/api/ppp/active${qs}`)
  return (data.sessions ?? data) as AnyRecord[]
}

async function fetchPPPProfiles(router?: string): Promise<AnyRecord[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<AnyRecord>(`/api/ppp/profiles${qs}`)
  return (data.profiles ?? data) as AnyRecord[]
}

export function usePPPSecrets(router?: string) {
  return useQuery({
    queryKey: ["ppp-secrets", router],
    queryFn: () => fetchPPPSecrets(router),
  })
}

export function usePPPActive(router?: string) {
  return useQuery({
    queryKey: ["ppp-active", router],
    queryFn: () => fetchPPPActive(router),
    refetchInterval: 30000,
  })
}

export function usePPPProfiles(router?: string) {
  return useQuery({
    queryKey: ["ppp-profiles", router],
    queryFn: () => fetchPPPProfiles(router),
  })
}

// --- Mutations ---

export function useAddPPPSecret() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiClient.post("/api/ppp/secrets", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppp-secrets"] })
    },
  })
}

export function useRemovePPPSecret() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      return apiClient.delete(`/api/ppp/secrets/${encodeURIComponent(name)}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppp-secrets"] })
    },
  })
}

export function useKickPPP() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.post(`/api/ppp/active/${encodeURIComponent(id)}/kick`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppp-active"] })
    },
  })
}
