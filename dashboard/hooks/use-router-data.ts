"use client"

import { useQuery } from "@tanstack/react-query"

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

export function useRouterTraffic() {
  return useQuery<TrafficData>({
    queryKey: ["router-traffic"],
    queryFn: async () => {
      const res = await fetch("/api/routers/traffic")
      if (!res.ok) return { router: "", interfaces: [] }
      return res.json()
    },
    refetchInterval: 30000,
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
      const res = await fetch(`/api/routers/logs?${params}`)
      if (!res.ok) return { router: "", total: 0, logs: [] }
      return res.json()
    },
    refetchInterval: 10000, // refresh every 10s for "real-time" feel
  })
}
