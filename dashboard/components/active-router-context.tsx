"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouters, type RouterData } from "@/hooks/use-routers"

const STORAGE_KEY = "active-router"

interface ActiveRouterContextValue {
  /** Nama router yang aktif (sesuai dengan Router.name di DB). */
  activeRouter: string
  setActiveRouter: (name: string) => void
  /** Object Router lengkap untuk router aktif. Null sebelum loaded / kalau tidak ditemukan. */
  activeRouterData: RouterData | null
  /** Daftar semua router milik user (pass-through dari useRouters). */
  routers: RouterData[]
  /** True selama useRouters masih initial loading. */
  isLoading: boolean
}

const ActiveRouterContext = createContext<ActiveRouterContextValue | null>(null)

export function ActiveRouterProvider({ children }: { children: ReactNode }) {
  const { data: routers = [], isLoading } = useRouters()

  // Hydrate dari localStorage on mount; SSR-safe (initial = "").
  const [activeRouter, setActiveRouterState] = useState<string>("")
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setActiveRouterState(saved)
    } catch {
      /* localStorage disabled / quota */
    }
  }, [])

  // Auto-pick default router setelah list loaded — kalau localStorage kosong
  // ATAU router yang tersimpan tidak ada di list (e.g. dihapus).
  useEffect(() => {
    if (isLoading || routers.length === 0) return
    const stillValid = routers.some((r) => r.name === activeRouter)
    if (!stillValid) {
      const defaultRouter = routers.find((r) => r.isDefault) ?? routers[0]
      setActiveRouterState(defaultRouter.name)
    }
  }, [routers, isLoading, activeRouter])

  const setActiveRouter = (name: string) => {
    setActiveRouterState(name)
    try {
      localStorage.setItem(STORAGE_KEY, name)
    } catch {
      /* ignore */
    }
  }

  const activeRouterData = useMemo(
    () => routers.find((r) => r.name === activeRouter) ?? null,
    [routers, activeRouter],
  )

  const value: ActiveRouterContextValue = {
    activeRouter,
    setActiveRouter,
    activeRouterData,
    routers,
    isLoading,
  }

  return (
    <ActiveRouterContext.Provider value={value}>
      {children}
    </ActiveRouterContext.Provider>
  )
}

/**
 * Hook untuk akses router aktif global. Harus dipanggil di dalam
 * <ActiveRouterProvider>. Pages yang sebelumnya punya local router selector
 * sekarang baca dari sini.
 *
 * Pakai sebagai filter API call:
 * ```ts
 * const { activeRouter } = useActiveRouter()
 * const { data } = useHotspotUsers(activeRouter || undefined)
 * ```
 */
export function useActiveRouter(): ActiveRouterContextValue {
  const ctx = useContext(ActiveRouterContext)
  if (!ctx) {
    throw new Error("useActiveRouter must be used within <ActiveRouterProvider>")
  }
  return ctx
}
