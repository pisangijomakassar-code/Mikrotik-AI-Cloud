"use client"

import { Construction } from "lucide-react"

interface PlatformPlaceholderProps {
  title: string
  description: string
  phase?: string
}

export function PlatformPlaceholder({
  title,
  description,
  phase = "Phase 4",
}: PlatformPlaceholderProps) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-2">
          {title}
        </h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="card-glass rounded-2xl p-12 flex flex-col items-center justify-center text-center max-w-2xl">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Construction className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-headline font-semibold text-foreground mb-2">
          Coming Soon
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Halaman ini akan diimplementasikan di <strong>{phase}</strong> — saat
          Super Admin features (Tenants, Billing, System Health, dst) mulai
          dibangun.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-4">
          Sidebar route + auth guard sudah aktif. Konten menyusul.
        </p>
      </div>
    </div>
  )
}
