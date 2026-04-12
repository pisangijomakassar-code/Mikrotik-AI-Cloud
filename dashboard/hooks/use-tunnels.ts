"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { Tunnel, TunnelPort, TunnelStatus } from "@/lib/types"

// ── Query Keys ──

export const tunnelKeys = {
  all: ["tunnels"] as const,
  byRouter: (routerId: string) => ["tunnels", routerId] as const,
  status: (routerId: string) => ["tunnels", routerId, "status"] as const,
  setup: (routerId: string) => ["tunnels", routerId, "setup"] as const,
}

// ── Response Types ──

export interface TunnelStatusResponse {
  status: TunnelStatus
  lastConnectedAt: string | null
  message?: string
}

export interface TunnelSetupResponse {
  method: "CLOUDFLARE" | "SSTP"
  // Cloudflare fields
  tunnelToken?: string
  cloudflareTunnelId?: string
  containerCommand?: string
  deviceModeCommand?: string
  // SSTP fields
  vpnHost?: string
  vpnUsername?: string
  vpnPassword?: string
  sstpCommand?: string
  // Common
  routerLanIp: string
  ports: TunnelPort[]
}

// ── Hooks ──

export function useTunnel(routerId: string, enabled = true) {
  return useQuery({
    queryKey: tunnelKeys.byRouter(routerId),
    queryFn: () => apiClient.get<Tunnel>(`/api/tunnels/${routerId}`),
    enabled: enabled && !!routerId,
  })
}

export function useTunnels() {
  return useQuery({
    queryKey: tunnelKeys.all,
    queryFn: () => apiClient.get<Tunnel[]>("/api/tunnels"),
  })
}

export function useTunnelStatus(routerId: string, enabled = true) {
  return useQuery({
    queryKey: tunnelKeys.status(routerId),
    queryFn: () => apiClient.get<TunnelStatusResponse>(`/api/tunnels/${routerId}/status`),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === "PENDING") return 5000
      if (status === "CONNECTED") return 30000
      return false
    },
    enabled: enabled && !!routerId,
  })
}

export function useTunnelSetup(routerId: string, enabled = true) {
  return useQuery({
    queryKey: tunnelKeys.setup(routerId),
    queryFn: () => apiClient.get<TunnelSetupResponse>(`/api/tunnels/${routerId}/setup`),
    enabled: enabled && !!routerId,
    staleTime: 5 * 60 * 1000, // credentials stable for 5 min
  })
}

export interface CreateTunnelInput {
  routerId: string
  method: "CLOUDFLARE" | "SSTP"
  routerLanIp?: string
  enabledPorts?: string[]
}

export function useCreateTunnel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTunnelInput) => {
      return apiClient.post<Tunnel>("/api/tunnels", input)
    },
    onSuccess: (_, { routerId }) => {
      queryClient.invalidateQueries({ queryKey: tunnelKeys.all })
      queryClient.invalidateQueries({ queryKey: tunnelKeys.byRouter(routerId) })
      queryClient.invalidateQueries({ queryKey: ["routers"] })
    },
  })
}

export function useDeleteTunnel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (routerId: string) => {
      return apiClient.delete<void>(`/api/tunnels/${routerId}`)
    },
    onSuccess: (_, routerId) => {
      queryClient.invalidateQueries({ queryKey: tunnelKeys.all })
      queryClient.invalidateQueries({ queryKey: tunnelKeys.byRouter(routerId) })
      queryClient.invalidateQueries({ queryKey: tunnelKeys.status(routerId) })
      queryClient.invalidateQueries({ queryKey: ["routers"] })
    },
  })
}

export function useUpdateTunnelPort() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      routerId,
      portId,
      enabled,
    }: {
      routerId: string
      portId: string
      enabled: boolean
    }) => {
      return apiClient.patch<TunnelPort>(`/api/tunnels/${routerId}/ports`, {
        portId,
        enabled,
      })
    },
    onSuccess: (_, { routerId }) => {
      queryClient.invalidateQueries({ queryKey: tunnelKeys.byRouter(routerId) })
    },
  })
}
