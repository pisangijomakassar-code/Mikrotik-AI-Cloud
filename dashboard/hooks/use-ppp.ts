"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

// --- Queries ---

async function fetchPPPSecrets(router?: string) {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<Record<string, unknown>>(`/api/ppp/secrets${qs}`)
  return (data as { secrets?: unknown[] }).secrets ?? data
}

async function fetchPPPActive(router?: string) {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<Record<string, unknown>>(`/api/ppp/active${qs}`)
  return (data as { sessions?: unknown[] }).sessions ?? data
}

async function fetchPPPProfiles(router?: string) {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<Record<string, unknown>>(`/api/ppp/profiles${qs}`)
  return (data as { profiles?: unknown[] }).profiles ?? data
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
