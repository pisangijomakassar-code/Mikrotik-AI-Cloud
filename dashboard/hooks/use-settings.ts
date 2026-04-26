"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

export interface NanobotSettings {
  agent: { model: string; provider: string }
  providers: string[]
  telegram: { enabled: boolean; allowFrom: string[] }
  mcpServers: string[]
  soul: string | null
  heartbeat: string | null
  configDir: string
}

export interface AgentUser {
  id: string
  name: string
  telegramId: string
  botToken: string | null
  status: string
}

export function useNanobotSettings() {
  return useQuery<NanobotSettings>({
    queryKey: ["settings"],
    queryFn: () => apiClient.get("/api/settings"),
  })
}

export function useAgentUsers() {
  return useQuery<AgentUser[]>({
    queryKey: ["settings", "agents"],
    queryFn: () => apiClient.get("/api/users"),
  })
}

export function useSaveSettingsField() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      return apiClient.patch("/api/settings", { field, value })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
  })
}

export function useSyncAgent() {
  return useMutation<{ usersProvisioned: number }>({
    mutationFn: () => apiClient.post("/api/provisioning"),
  })
}
