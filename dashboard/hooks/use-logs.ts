"use client"

import { useQuery } from "@tanstack/react-query"
import type { LogFilter, PaginatedResult } from "@/lib/types"

export interface LogEntry {
  id: string
  userId: string
  routerId: string | null
  action: string
  tool: string | null
  status: string
  duration: number | null
  details: string | null
  createdAt: string
  user?: { name: string }
  router?: { name: string }
}

async function fetchLogs(
  filter?: LogFilter
): Promise<PaginatedResult<LogEntry>> {
  const params = new URLSearchParams()
  if (filter?.userId) params.set("userId", filter.userId)
  if (filter?.action) params.set("action", filter.action)
  if (filter?.status) params.set("status", filter.status)
  if (filter?.from) params.set("from", filter.from.toISOString())
  if (filter?.to) params.set("to", filter.to.toISOString())
  if (filter?.page) params.set("page", String(filter.page))
  if (filter?.pageSize) params.set("pageSize", String(filter.pageSize))
  const url = `/api/logs${params.toString() ? `?${params}` : ""}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch logs")
  return res.json()
}

export function useLogs(filter?: LogFilter) {
  return useQuery({
    queryKey: ["logs", filter],
    queryFn: () => fetchLogs(filter),
  })
}
