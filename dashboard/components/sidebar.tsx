"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Brain, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/sidebar-context"
import { navGroups as defaultNavGroups, type NavGroup } from "@/components/sidebar/nav-config"
import { CollapsibleGroup } from "@/components/sidebar/collapsible-group"
import { PlanCard } from "@/components/sidebar/plan-card"
import { ActiveRouterCard } from "@/components/sidebar/active-router-card"

interface SidebarProps {
  /** Navigation config — defaults to admin tenant navGroups. Pass `navGroupsPlatform` for SUPER_ADMIN. */
  config?: NavGroup[]
  /** Display name di header sidebar. Default "MikroTik AI". */
  brandName?: string
  /** Subtitle kecil di bawah brand name. Default "AI-Driven Network". */
  brandSubtitle?: string
  /** Tampilkan ActiveRouterCard (selector router) — admin tenant only. Default true. */
  showActiveRouter?: boolean
  /** Tampilkan PlanCard di bawah — admin tenant only. Default true. */
  showPlanCard?: boolean
  /** localStorage key untuk persist open state. Default "sidebar-groups". */
  storageKey?: string
}

function loadOpenState(key: string): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveOpenState(key: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {}
}

export function Sidebar({
  config = defaultNavGroups,
  brandName = "MikroTik AI",
  brandSubtitle = "AI-Driven Network",
  showActiveRouter = true,
  showPlanCard = true,
  storageKey = "sidebar-groups",
}: SidebarProps = {}) {
  const pathname = usePathname()
  const { user, isAdmin } = useAuth()
  const { isOpen, close } = useSidebar()

  const visibleGroups = useMemo(
    () => config.filter((g) => !g.adminOnly || isAdmin),
    [config, isAdmin]
  )

  const [openState, setOpenState] = useState<Record<string, boolean>>(() => {
    const saved = loadOpenState(storageKey)
    const initial: Record<string, boolean> = {}
    for (const group of config) {
      if (group.defaultOpen) {
        initial[group.label] = true
        continue
      }
      if (saved[group.label] !== undefined) {
        initial[group.label] = saved[group.label]
      } else {
        initial[group.label] = false
      }
    }
    return initial
  })

  // Auto-open group when current path matches a child route
  useEffect(() => {
    if (!pathname) return
    setOpenState((prev) => {
      let changed = false
      const next = { ...prev }
      for (const group of config) {
        if (group.defaultOpen) continue
        const hasActiveChild = group.items.some(
          (item) =>
            pathname === item.href || pathname.startsWith(item.href + "/")
        )
        if (hasActiveChild && !prev[group.label]) {
          next[group.label] = true
          changed = true
        }
      }
      if (changed) {
        saveOpenState(storageKey, next)
        return next
      }
      return prev
    })
  }, [pathname, config, storageKey])

  const toggleGroup = useCallback((label: string) => {
    setOpenState((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      saveOpenState(storageKey, next)
      return next
    })
  }, [storageKey])

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[55] bg-black/50 lg:hidden" onClick={close} />
      )}
    <aside className={cn(
      "flex flex-col fixed left-0 top-0 h-full h-screen w-64 border-r border-primary/20 bg-card shadow-[0_0_32px_rgba(76,215,246,0.08)] z-[60] transition-transform duration-300",
      isOpen ? "translate-x-0" : "-translate-x-full",
      "lg:translate-x-0"
    )}>
      {/* Mobile close button */}
      <button
        onClick={close}
        className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground lg:hidden"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Logo */}
      <div className="px-6 pt-6 pb-2 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center">
            <Brain className="h-5 w-5 text-[#00424f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-br from-cyan-400 to-cyan-600 bg-clip-text text-transparent font-headline">
              {brandName}
            </h1>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">
              {brandSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Active Router Selector — admin tenant only (super admin tidak punya konteks router) */}
      {showActiveRouter && <ActiveRouterCard />}

      {/* Navigation */}
      <nav className="flex-1 mt-2 overflow-y-auto font-headline text-sm tracking-tight">
        {visibleGroups.map((group, idx) => (
          <div key={group.label}>
            {idx > 0 && (
              <div className="border-t border-border my-2" />
            )}
            <CollapsibleGroup
              group={group}
              isAdmin={isAdmin}
              pathname={pathname ?? ""}
              isOpen={!!openState[group.label]}
              onToggle={() => toggleGroup(group.label)}
              onNavClick={() => { if (window.innerWidth < 1024) close() }}
            />
          </div>
        ))}
      </nav>

      {/* Plan Card — admin tenant only */}
      {showPlanCard && <PlanCard />}
    </aside>
    </>
  )
}
