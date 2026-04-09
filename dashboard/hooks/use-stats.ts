"use client"

import { useQuery } from "@tanstack/react-query"
import type { DashboardStats } from "@/lib/types"

async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch("/api/stats")
  if (!res.ok) throw new Error("Failed to fetch stats")
  return res.json()
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  })
}
