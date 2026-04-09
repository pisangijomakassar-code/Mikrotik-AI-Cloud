"use client"

import { Router } from "lucide-react"
import { RouterGrid } from "@/components/router-grid"
import { AddRouterDialog } from "@/components/add-router-dialog"

export default function RoutersPage() {
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Router Management</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Router className="h-[18px] w-[18px] text-[#4cd7f6]" />
            Monitor and manage all connected MikroTik nodes.
          </p>
        </div>
        <AddRouterDialog />
      </div>
      <RouterGrid />
    </div>
  )
}
