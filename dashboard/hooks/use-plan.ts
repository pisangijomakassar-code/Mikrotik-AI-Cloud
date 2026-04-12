"use client"

import { useQuery } from "@tanstack/react-query"
import type { PlanKey } from "@/lib/constants/plan-limits"

export function usePlan() {
  return useQuery({
    queryKey: ["plan"],
    queryFn: async (): Promise<PlanKey> => {
      const res = await fetch("/api/plan")
      if (!res.ok) return "FREE"
      const data = await res.json()
      return (data.subscription?.plan ?? "FREE") as PlanKey
    },
    staleTime: 5 * 60 * 1000,
  })
}
