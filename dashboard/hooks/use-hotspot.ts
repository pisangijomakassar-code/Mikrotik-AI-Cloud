"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

// --- Types ---

export interface HotspotUser {
  name: string
  password?: string
  profile: string
  disabled: boolean
  server?: string
  address?: string
  macAddress?: string
  comment?: string
  limitUptime?: string
  limitBytesTotal?: string
  uptime?: string
  bytesIn?: number
  bytesOut?: number
}

export interface HotspotActiveSession {
  user: string
  address: string
  macAddress: string
  server: string
  uptime: string
  bytesIn?: number
  bytesOut?: number
  idleTime?: string
  loginBy?: string
}

export interface HotspotProfile {
  name: string
  rateLimit?: string
  sharedUsers?: number | string
  sessionTimeout?: string
  idleTimeout?: string
  keepaliveTimeout?: string
  addressPool?: string
  onLogin?: string
  onLogout?: string
  /** Injected by /api/hotspot/profiles from VoucherProfileSetting */
  price?: number
}

export interface HotspotProfileInput {
  name: string
  rateLimit?: string
  sharedUsers?: number
  sessionTimeout?: string
  idleTimeout?: string
  addressPool?: string
  onLogin?: string
  onLogout?: string
  router?: string
}

export interface HotspotServer {
  name: string
  interface: string
  disabled: string
}

export interface HotspotStats {
  totalUsers?: number
  activeSessions?: number
  totalProfiles?: number
  disabledUsers?: number
}

export interface AddHotspotUserInput {
  name: string
  password?: string
  profile?: string
  server?: string
  router?: string
  comment?: string
  "limit-uptime"?: string
  "limit-bytes-total"?: string
  "limit-bytes-in"?: string
  "limit-bytes-out"?: string
}

// --- Fetch helpers ---

async function fetchHotspotUsers(router?: string): Promise<HotspotUser[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<{ users?: HotspotUser[] } & HotspotUser[]>(`/api/hotspot/users${qs}`)
  return (data as { users?: HotspotUser[] }).users ?? data
}

async function fetchHotspotActive(router?: string): Promise<HotspotActiveSession[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<{ sessions?: HotspotActiveSession[] } & HotspotActiveSession[]>(`/api/hotspot/active${qs}`)
  return (data as { sessions?: HotspotActiveSession[] }).sessions ?? data
}

async function fetchHotspotProfiles(router?: string): Promise<HotspotProfile[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<{ profiles?: HotspotProfile[] } & HotspotProfile[]>(`/api/hotspot/profiles${qs}`)
  return (data as { profiles?: HotspotProfile[] }).profiles ?? (data as HotspotProfile[])
}

async function fetchHotspotServers(router?: string): Promise<HotspotServer[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<{ servers?: HotspotServer[] }>(`/api/hotspot/servers${qs}`)
  return data.servers ?? []
}

export interface IpPool {
  name: string
  ranges: string
}

async function fetchIpPools(router?: string): Promise<IpPool[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const data = await apiClient.get<{ pools?: IpPool[] }>(`/api/hotspot/pools${qs}`)
  return data.pools ?? []
}

async function fetchHotspotStats(router?: string): Promise<HotspotStats> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  return apiClient.get(`/api/hotspot/stats${qs}`)
}

// --- Query hooks ---

export function useHotspotUsers(router?: string) {
  return useQuery({
    queryKey: ["hotspot-users", router],
    queryFn: () => fetchHotspotUsers(router),
  })
}

export function useHotspotActive(router?: string) {
  return useQuery({
    queryKey: ["hotspot-active", router],
    queryFn: () => fetchHotspotActive(router),
    refetchInterval: 30000,
  })
}

export function useHotspotProfiles(router?: string) {
  return useQuery({
    queryKey: ["hotspot-profiles", router],
    queryFn: () => fetchHotspotProfiles(router),
  })
}

export function useHotspotServers(router?: string) {
  return useQuery({
    queryKey: ["hotspot-servers", router],
    queryFn: () => fetchHotspotServers(router),
  })
}

export function useIpPools(router?: string) {
  return useQuery({
    queryKey: ["ip-pools", router],
    queryFn: () => fetchIpPools(router),
  })
}

export function useHotspotStats(router?: string) {
  return useQuery({
    queryKey: ["hotspot-stats", router],
    queryFn: () => fetchHotspotStats(router),
    refetchInterval: 30000,
  })
}

// --- Mutation hooks ---

export function useAddHotspotUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: AddHotspotUserInput) => {
      return apiClient.post("/api/hotspot/users", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotspot-users"] })
      queryClient.invalidateQueries({ queryKey: ["hotspot-stats"] })
    },
  })
}

export function useRemoveHotspotUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (username: string) => {
      return apiClient.delete(`/api/hotspot/users/${encodeURIComponent(username)}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotspot-users"] })
      queryClient.invalidateQueries({ queryKey: ["hotspot-stats"] })
    },
  })
}

export function useEnableHotspotUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (username: string) => {
      return apiClient.post(`/api/hotspot/users/${encodeURIComponent(username)}/enable`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotspot-users"] })
      queryClient.invalidateQueries({ queryKey: ["hotspot-stats"] })
    },
  })
}

export function useDisableHotspotUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (username: string) => {
      return apiClient.post(`/api/hotspot/users/${encodeURIComponent(username)}/disable`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotspot-users"] })
      queryClient.invalidateQueries({ queryKey: ["hotspot-stats"] })
    },
  })
}

export function useAddHotspotProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: HotspotProfileInput) => apiClient.post("/api/hotspot/profiles", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotspot-profiles"] }),
  })
}

export function useUpdateHotspotProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, ...data }: HotspotProfileInput & { name: string }) =>
      apiClient.put(`/api/hotspot/profiles/${encodeURIComponent(name)}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotspot-profiles"] }),
  })
}

export function useDeleteHotspotProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => apiClient.delete(`/api/hotspot/profiles/${encodeURIComponent(name)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hotspot-profiles"] }),
  })
}
