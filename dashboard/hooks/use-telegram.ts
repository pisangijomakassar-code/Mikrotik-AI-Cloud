"use client"

import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

interface SendTelegramInput {
  chatId?: string
  chatIds?: string[]
  message: string
}

export function useSendTelegram() {
  return useMutation({
    mutationFn: async (data: SendTelegramInput) => {
      return apiClient.post("/api/telegram/send", data)
    },
  })
}
