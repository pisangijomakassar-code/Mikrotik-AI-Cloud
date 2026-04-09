"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { CreateUserInput, UpdateUserInput, UserFilter } from "@/lib/types"

interface User {
  id: string
  name: string
  email: string | null
  telegramId: string
  botToken: string | null
  role: "ADMIN" | "USER"
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  lastActive: string | null
  createdAt: string
  _count?: { routers: number }
}

async function fetchUsers(filter?: UserFilter): Promise<User[]> {
  const params = new URLSearchParams()
  if (filter?.status) params.set("status", filter.status)
  if (filter?.role) params.set("role", filter.role)
  if (filter?.search) params.set("search", filter.search)
  const url = `/api/users${params.toString() ? `?${params}` : ""}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch users")
  return res.json()
}

export function useUsers(filter?: UserFilter) {
  return useQuery({
    queryKey: ["users", filter],
    queryFn: () => fetchUsers(filter),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create user" }))
        throw new Error(err.error || "Failed to create user")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserInput }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update user" }))
        throw new Error(err.error || "Failed to update user")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete user")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}
