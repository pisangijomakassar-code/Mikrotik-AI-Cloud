"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { CreateRouterInput } from "@/lib/types"

export interface RouterData {
  id: string
  name: string
  host: string
  port: number
  username: string
  label: string | null
  isDefault: boolean
  userId: string
  createdAt: string
  user?: { name: string }
  health?: {
    status: "online" | "offline" | "warning"
    board: string
    version: string
    cpuLoad: number
    memoryUsed: number
    memoryTotal: number
    activeClients: number
    uptime: string
  }
}

async function fetchRouters(search?: string): Promise<RouterData[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : ""
  const res = await fetch(`/api/routers${params}`)
  if (!res.ok) throw new Error("Failed to fetch routers")
  return res.json()
}

interface RouterHealth {
  id: string
  name: string
  status: "online" | "offline"
  cpuLoad?: number
  memoryPercent?: number
  uptime?: string
  activeClients?: number
  version?: string
}

async function fetchHealth(): Promise<RouterHealth[]> {
  const res = await fetch("/api/routers/health")
  if (!res.ok) return []
  return res.json()
}

export function useRouters(search?: string) {
  const routersQuery = useQuery({
    queryKey: ["routers", search],
    queryFn: () => fetchRouters(search),
  })

  const healthQuery = useQuery({
    queryKey: ["routers-health"],
    queryFn: fetchHealth,
    refetchInterval: 60000, // refresh every 60s
  })

  // Merge health data into routers
  const routers = routersQuery.data?.map((router) => {
    const health = healthQuery.data?.find((h) => h.id === router.id)
    return {
      ...router,
      health: health
        ? {
            status: health.status,
            cpuLoad: health.cpuLoad ?? 0,
            memoryPercent: health.memoryPercent ?? 0,
            memoryUsed: ((health as Record<string, unknown>).memoryTotalMB as number ?? 0) - ((health as Record<string, unknown>).memoryFreeMB as number ?? 0),
            memoryTotal: (health as Record<string, unknown>).memoryTotalMB as number ?? 0,
            activeClients: health.activeClients ?? 0,
            uptime: health.uptime ?? "",
            version: health.version ?? "",
            board: (health as Record<string, unknown>).board as string ?? "",
          }
        : undefined,
    }
  })

  return {
    ...routersQuery,
    data: routers,
  }
}

export function useCreateRouter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateRouterInput) => {
      const res = await fetch("/api/routers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add router" }))
        throw new Error(err.error || "Failed to add router")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routers"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}

export function useDeleteRouter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/routers/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete router")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routers"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}
