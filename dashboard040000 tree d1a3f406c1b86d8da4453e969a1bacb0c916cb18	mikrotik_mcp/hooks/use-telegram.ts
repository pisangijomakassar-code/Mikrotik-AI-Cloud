"use client"

import { useMutation } from "@tanstack/react-query"

interface SendTelegramInput {
  chatId?: string
  chatIds?: string[]
  message: string
  photo?: File | null
}

export function useSendTelegram() {
  return useMutation({
    mutationFn: async (data: SendTelegramInput) => {
      if (data.photo) {
        const form = new FormData()
        if (data.chatId) form.append("chatId", data.chatId)
        if (data.chatIds?.length) form.append("chatIds", data.chatIds.join(","))
        form.append("message", data.message)
        form.append("photo", data.photo, data.photo.name)

        const res = await fetch("/api/telegram/send", { method: "POST", body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(err.error || "Failed to send")
        }
        return res.json()
      }

      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: data.chatId,
          chatIds: data.chatIds,
          message: data.message,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || "Failed to send")
      }
      return res.json()
    },
  })
}
