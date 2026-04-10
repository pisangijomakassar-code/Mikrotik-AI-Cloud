"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// --- Types ---

export interface HotspotUser {
  name: string
  profile: string
  disabled: boolean
  server?: string
  address?: string
  "mac-address"?: string
  comment?: string
  "limit-uptime"?: string
  "limit-bytes-total"?: string
  uptime?: string
  "bytes-in"?: number
  "bytes-out"?: number
}

export interface HotspotActiveSession {
  user: string
  address: string
  "mac-address": string
  server: string
  uptime: string
  "bytes-in"?: number
  "bytes-out"?: number
  "idle-time"?: string
  "login-by"?: string
}

export interface HotspotProfile {
  name: string
  "rate-limit"?: string
  "shared-users"?: string
  "session-timeout"?: string
  "idle-timeout"?: string
  "keepalive-timeout"?: string
  "address-pool"?: string
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
}

// --- Fetch helpers ---

async function fetchHotspotUsers(router?: string): Promise<HotspotUser[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const res = await fetch(`/api/hotspot/users${qs}`)
  if (!res.ok) throw new Error("Failed to fetch hotspot users")
  const data = await res.json()
  return data.users ?? data
}

async function fetchHotspotActive(router?: string): Promise<HotspotActiveSession[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const res = await fetch(`/api/hotspot/active${qs}`)
  if (!res.ok) throw new Error("Failed to fetch active sessions")
  const data = await res.json()
  return data.sessions ?? data
}

async function fetchHotspotProfiles(router?: string): Promise<HotspotProfile[]> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const res = await fetch(`/api/hotspot/profiles${qs}`)
  if (!res.ok) throw new Error("Failed to fetch hotspot profiles")
  const data = await res.json()
  return data.profiles ?? data
}

async function fetchHotspotStats(router?: string): Promise<HotspotStats> {
  const qs = router ? `?router=${encodeURIComponent(router)}` : ""
  const res = await fetch(`/api/hotspot/stats${qs}`)
  if (!res.ok) throw new Error("Failed to fetch hotspot stats")
  return res.json()
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
      const res = await fetch("/api/hotspot/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add hotspot user" }))
        throw new Error(err.error || "Failed to add hotspot user")
      }
      return res.json()
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
      const res = await fetch(`/api/hotspot/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to remove hotspot user" }))
        throw new Error(err.error || "Failed to remove hotspot user")
      }
      return res.json()
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
      const res = await fetch(`/api/hotspot/users/${encodeURIComponent(username)}/enable`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to enable hotspot user" }))
        throw new Error(err.error || "Failed to enable hotspot user")
      }
      return res.json()
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
      const res = await fetch(`/api/hotspot/users/${encodeURIComponent(username)}/disable`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to disable hotspot user" }))
        throw new Error(err.error || "Failed to disable hotspot user")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotspot-users"] })
      queryClient.invalidateQueries({ queryKey: ["hotspot-stats"] })
    },
  })
}
