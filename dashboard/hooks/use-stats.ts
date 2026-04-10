"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { DashboardStats } from "@/lib/types"

async function fetchStats(): Promise<DashboardStats> {
  return apiClient.get("/api/stats")
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  })
}
