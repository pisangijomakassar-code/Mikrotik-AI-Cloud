"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TenantTable, type TenantRow } from "@/components/platform/tenant-table"
import { CreateTenantDialog } from "@/components/platform/create-tenant-dialog"

export default function AllTenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/tenants")
      if (res.ok) setTenants(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">
            All Tenants
          </h2>
          <p className="text-muted-foreground">
            {loading ? "Loading…" : `${tenants.length} tenant${tenants.length !== 1 ? "s" : ""} total`}
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Tenant
        </Button>
      </div>

      <div className="card-glass rounded-2xl p-6">
        <TenantTable tenants={tenants} loading={loading} onRefresh={load} />
      </div>

      <CreateTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
    </div>
  )
}
