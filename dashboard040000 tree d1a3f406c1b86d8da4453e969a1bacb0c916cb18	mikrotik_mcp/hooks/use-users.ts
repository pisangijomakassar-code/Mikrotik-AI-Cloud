"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
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
  return apiClient.get(url)
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
      return apiClient.post("/api/users", data)
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
      return apiClient.patch(`/api/users/${id}`, data)
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
      return apiClient.delete(`/api/users/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}
