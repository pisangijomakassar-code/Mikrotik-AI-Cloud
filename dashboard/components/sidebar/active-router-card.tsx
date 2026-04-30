"use client"

import { useState } from "react"
import { Router as RouterIcon, ChevronDown, Check, Plus, X } from "lucide-react"
import { useActiveRouter } from "@/components/active-router-context"
import { cn } from "@/lib/utils"

export function ActiveRouterCard() {
  const { activeRouter, setActiveRouter, activeRouterData, routers, isLoading } = useActiveRouter()
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="px-6 mt-2 mb-3">
        <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
      </div>
    )
  }

  if (routers.length === 0) {
    return (
      <div className="px-6 mt-2 mb-3">
        <a
          href="/routers"
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah Router
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="px-6 mt-2 mb-3">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 border border-white/5 transition-colors text-left"
          title="Ganti router aktif"
        >
          <RouterIcon className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70 leading-none">
              Router aktif
            </div>
            <div className="text-xs font-bold text-foreground font-mono-tech truncate">
              {activeRouter || "—"}
            </div>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0f1623] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Pilih Router Aktif</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 max-h-[60vh] overflow-y-auto">
              {routers.map((r) => {
                const isActive = r.name === activeRouter
                const status = r.health?.status ?? "unknown"
                const statusStyle =
                  status === "online"
                    ? "bg-tertiary/15 text-tertiary"
                    : status === "warning"
                      ? "bg-amber-500/15 text-amber-400"
                      : status === "offline"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-slate-500/15 text-slate-400"
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setActiveRouter(r.name)
                      setOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left",
                      isActive
                        ? "bg-primary/15 border border-primary/30"
                        : "hover:bg-muted/50 border border-transparent",
                    )}
                  >
                    <div className="w-5 flex justify-center">
                      {isActive ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <RouterIcon className="h-4 w-4 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground font-mono-tech truncate">
                        {r.name}
                        {r.isDefault && (
                          <span className="ml-2 text-[9px] font-normal text-muted-foreground/60 uppercase">
                            default
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 truncate">
                        {r.host}:{r.port}
                        {r.label && ` · ${r.label}`}
                      </div>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase", statusStyle)}>
                      {status}
                    </span>
                  </button>
                )
              })}

              <a
                href="/routers"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Kelola Router
              </a>
            </div>

            <div className="p-3 border-t border-white/10 text-[10px] text-muted-foreground/60 text-center">
              Pilihan tersimpan di browser. Semua menu akan menampilkan data router yang dipilih.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
