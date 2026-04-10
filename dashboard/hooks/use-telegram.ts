"use client"

import { useMutation } from "@tanstack/react-query"

interface SendTelegramInput {
  chatId?: string
  chatIds?: string[]
  message: string
}

export function useSendTelegram() {
  return useMutation({
    mutationFn: async (data: SendTelegramInput) => {
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to send Telegram message" }))
        throw new Error(err.error || "Failed to send Telegram message")
      }
      return res.json()
    },
  })
}
