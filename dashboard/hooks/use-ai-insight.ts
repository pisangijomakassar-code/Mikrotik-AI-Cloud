"use client"

import { useMutation } from "@tanstack/react-query"

export function useAIInsight() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dashboard/ai-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to generate AI insight" }))
        throw new Error(err.error || "Failed to generate AI insight")
      }
      return res.json()
    },
  })
}
