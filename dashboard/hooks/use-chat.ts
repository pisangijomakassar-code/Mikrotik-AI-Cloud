"use client"

import { useMutation } from "@tanstack/react-query"

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
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to send message" }))
    throw new Error(err.error || "Failed to send message")
  }
  return res.json()
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
