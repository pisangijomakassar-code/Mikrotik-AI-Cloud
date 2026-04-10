"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// --- Queries ---

async function fetchPPPSecrets(router?: string) {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const res = await fetch(`/api/ppp/secrets${qs}`)
  if (!res.ok) throw new Error("Failed to fetch PPP secrets")
  const data = await res.json()
  return data.secrets ?? data
}

async function fetchPPPActive(router?: string) {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const res = await fetch(`/api/ppp/active${qs}`)
  if (!res.ok) throw new Error("Failed to fetch PPP active sessions")
  const data = await res.json()
  return data.sessions ?? data
}

async function fetchPPPProfiles(router?: string) {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const res = await fetch(`/api/ppp/profiles${qs}`)
  if (!res.ok) throw new Error("Failed to fetch PPP profiles")
  const data = await res.json()
  return data.profiles ?? data
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
      const res = await fetch("/api/ppp/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add PPP secret" }))
        throw new Error(err.error || "Failed to add PPP secret")
      }
      return res.json()
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
      const res = await fetch(`/api/ppp/secrets/${encodeURIComponent(name)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to remove PPP secret" }))
        throw new Error(err.error || "Failed to remove PPP secret")
      }
      return res.json()
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
      const res = await fetch(`/api/ppp/active/${encodeURIComponent(id)}/kick`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to kick PPP session" }))
        throw new Error(err.error || "Failed to kick PPP session")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppp-active"] })
    },
  })
}
