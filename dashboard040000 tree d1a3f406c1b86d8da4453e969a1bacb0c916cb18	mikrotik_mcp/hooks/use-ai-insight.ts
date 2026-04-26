"use client"

import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAIInsight() {
  return useMutation({
    mutationFn: async () => {
      return apiClient.post<Record<string, any>>("/api/dashboard/ai-insight")
    },
  })
}
