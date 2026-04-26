"use client"

import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  imageUrl?: string
  timestamp: Date
}

interface SendMessageInput {
  message: string
  image?: string // base64
}

interface ChatResponse {
  reply: string
}

async function sendMessage(data: SendMessageInput): Promise<ChatResponse> {
  return apiClient.post("/api/chat", data)
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("image", file)
  const res = await fetch("/api/chat/upload", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) {
    throw new Error("Failed to upload image")
  }
  const data = await res.json()
  return data.url
}

export function useSendMessage() {
  return useMutation({
    mutationFn: sendMessage,
  })
}

export function useUploadImage() {
  return useMutation({
    mutationFn: uploadImage,
  })
}

export type { ChatMessage, SendMessageInput, ChatResponse }
