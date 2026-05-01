"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { DashboardStats } from "@/lib/types"

// Stats user-scoped, BUKAN router-scoped (totalRouters, totalLogs aggregate per
// user). Tidak perlu activeRouter sebagai filter.
async function fetchStats(): Promise<DashboardStats> {
  return apiClient.get("/api/stats")
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  })
}
