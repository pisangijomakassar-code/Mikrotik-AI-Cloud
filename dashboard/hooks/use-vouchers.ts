"use client"

import { useQuery } from "@tanstack/react-query"

interface VoucherFilter {
  source?: string
  resellerId?: string
  page?: number
  pageSize?: number
}

async function fetchAllVouchers(filter?: VoucherFilter) {
  const params = new URLSearchParams()
  if (filter?.source) params.set("source", filter.source)
  if (filter?.resellerId) params.set("resellerId", filter.resellerId)
  if (filter?.page) params.set("page", String(filter.page))
  if (filter?.pageSize) params.set("pageSize", String(filter.pageSize))

  const qs = params.toString()
  const res = await fetch(`/api/vouchers${qs ? `?${qs}` : ""}`)
  if (!res.ok) throw new Error("Failed to fetch vouchers")
  return res.json()
}

export function useAllVouchers(filter?: VoucherFilter) {
  return useQuery({
    queryKey: ["vouchers", filter],
    queryFn: () => fetchAllVouchers(filter),
  })
}
