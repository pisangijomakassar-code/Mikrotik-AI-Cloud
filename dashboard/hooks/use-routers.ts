"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
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
    memoryPercent: number
    memoryUsed: number
    memoryTotal: number
    activeClients: number
    uptime: string
  }
}

async function fetchRouters(search?: string): Promise<RouterData[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : ""
  return apiClient.get(`/api/routers${params}`)
}

interface RouterHealth {
  id: string
  name: string
  status: "online" | "offline"
  cpuLoad?: number
  memoryPercent?: number
  memoryTotalMB?: number
  memoryFreeMB?: number
  board?: string
  uptime?: string
  activeClients?: number
  version?: string
}

async function fetchHealth(): Promise<RouterHealth[]> {
  try {
    return await apiClient.get("/api/routers/health")
  } catch {
    return []
  }
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
            memoryUsed: (health.memoryTotalMB ?? 0) - (health.memoryFreeMB ?? 0),
            memoryTotal: health.memoryTotalMB ?? 0,
            activeClients: health.activeClients ?? 0,
            uptime: health.uptime ?? "",
            version: health.version ?? "",
            board: health.board ?? "",
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
      return apiClient.post("/api/routers", data)
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
      return apiClient.delete(`/api/routers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routers"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}
