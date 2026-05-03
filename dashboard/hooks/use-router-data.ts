"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

// --- Traffic data (for Network Throughput) ---
interface InterfaceTraffic {
  name: string
  type: string
  txBytes: number
  rxBytes: number
  txPackets: number
  rxPackets: number
  running: boolean
}

interface TrafficData {
  router: string
  interfaces: InterfaceTraffic[]
}

export function useRouterTraffic(router?: string) {
  return useQuery<TrafficData>({
    queryKey: ["router-traffic", router ?? ""],
    queryFn: async () => {
      const qs = router ? `?router=${encodeURIComponent(router)}` : ""
      try {
        return await apiClient.get<TrafficData>(`/api/routers/traffic${qs}`)
      } catch {
        return { router: "", interfaces: [] }
      }
    },
    refetchInterval: 30000,
  })
}

// --- Monthly / range traffic (dari TrafficSnapshot, sumber DB) ---
interface MonthlyInterface {
  name: string
  txBytes: number
  rxBytes: number
}

export interface MonthlyTrafficData {
  router: string
  interfaces: MonthlyInterface[]
  totalTx: number
  totalRx: number
  year?: number
  month?: number
  start?: string
  end?: string
  error?: string
}

interface MonthlyTrafficArgs {
  router?: string
  year?: number
  month?: number
  start?: string
  end?: string
  enabled?: boolean
}

export function useRouterTrafficMonthly(args: MonthlyTrafficArgs = {}) {
  const { router, year, month, start, end, enabled = true } = args
  const qs = new URLSearchParams()
  if (router) qs.set("router", router)
  if (year) qs.set("year", String(year))
  if (month) qs.set("month", String(month))
  if (start) qs.set("start", start)
  if (end) qs.set("end", end)
  return useQuery<MonthlyTrafficData>({
    queryKey: ["router-traffic-monthly", router, year, month, start, end],
    queryFn: async () => {
      try {
        return await apiClient.get<MonthlyTrafficData>(
          `/api/routers/traffic-monthly?${qs.toString()}`,
        )
      } catch {
        return { router: router || "", interfaces: [], totalTx: 0, totalRx: 0 }
      }
    },
    enabled,
    refetchInterval: 60_000, // 1 menit cukup, data berubah lambat
    staleTime: 30_000,
  })
}

// --- Router logs (real-time, no LLM) ---
interface RouterLog {
  time: string
  topics: string
  message: string
}

interface RouterLogsData {
  router: string
  total: number
  logs: RouterLog[]
}

export function useRouterLogs(routerName?: string, count = 50) {
  return useQuery<RouterLogsData>({
    queryKey: ["router-logs", routerName, count],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (routerName) params.set("router", routerName)
      params.set("count", String(count))
      try {
        return await apiClient.get<RouterLogsData>(`/api/routers/logs?${params}`)
      } catch {
        return { router: "", total: 0, logs: [] }
      }
    },
    refetchInterval: 10000, // refresh every 10s for "real-time" feel
  })
}
