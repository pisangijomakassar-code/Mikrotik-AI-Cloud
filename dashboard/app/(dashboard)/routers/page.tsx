"use client"

import { RouterGrid } from "@/components/router-grid"

export default function RoutersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Routers</h1>
        <p className="text-sm text-muted-foreground">
          Monitor and manage your MikroTik routers.
        </p>
      </div>
      <RouterGrid />
    </div>
  )
}
