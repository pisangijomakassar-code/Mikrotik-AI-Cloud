"use client"

import { useEffect, useState, useCallback } from "react"
import { Sparkles } from "lucide-react"
import { TenantTable, type TenantRow } from "@/components/platform/tenant-table"

export default function TrialTenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/tenants?status=TRIAL")
      if (res.ok) setTenants(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-[#4cd7f6]" />
          Trials
        </h2>
        <p className="text-muted-foreground">
          {loading ? "Loading…" : `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} on trial — needs conversion`}
        </p>
      </div>

      {!loading && tenants.length === 0 ? (
        <div className="card-glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Sparkles className="h-10 w-10 text-[#869397] mb-3" />
          <p className="font-headline font-semibold text-foreground">No trial tenants</p>
          <p className="text-sm text-muted-foreground mt-1">All tenants have converted to paid plans</p>
        </div>
      ) : (
        <div className="card-glass rounded-2xl p-6">
          <TenantTable tenants={tenants} loading={loading} onRefresh={load} />
        </div>
      )}
    </div>
  )
}
