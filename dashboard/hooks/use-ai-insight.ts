"use client"

import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

export function useAIInsight() {
  return useMutation({
    mutationFn: async () => {
      return apiClient.post("/api/dashboard/ai-insight")
    },
  })
}
