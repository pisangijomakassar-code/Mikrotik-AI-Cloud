"use client"

import { Router } from "lucide-react"
import { RouterGrid } from "@/components/router-grid"
import { AddRouterWizard } from "@/components/add-router-wizard"
import { cn } from "@/lib/utils"
import { useState } from "react"

export default function RoutersPage() {
  const [view, setView] = useState<"table" | "map">("table")

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Router Management</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Router className="h-[18px] w-[18px] text-primary shrink-0" />
            Monitor and manage all connected MikroTik nodes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-surface-low rounded-lg p-1 border border-border/20">
            <button
              onClick={() => setView("table")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-colors",
                view === "table" ? "bg-muted text-primary" : "text-slate-400 hover:text-foreground"
              )}
            >
              Table View
            </button>
            <button
              onClick={() => setView("map")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-colors",
                view === "map" ? "bg-muted text-primary" : "text-slate-400 hover:text-foreground"
              )}
            >
              Map View
            </button>
          </div>
          <AddRouterWizard />
        </div>
      </div>
      {view === "table" ? (
        <RouterGrid />
      ) : (
        <div className="bg-surface-low rounded-2xl border border-border/20 p-12 flex flex-col items-center justify-center gap-3">
          <Router className="h-10 w-10 text-slate-500/50" />
          <p className="text-sm text-slate-400">Map view coming soon</p>
          <p className="text-[10px] text-slate-600">Visual topology of your router network</p>
        </div>
      )}
    </div>
  )
}
