"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Router,
  Terminal,
  Settings,
  Sparkles,
  Brain,
  Bot,
  BookOpen,
  UserCircle,
  CreditCard,
  Wifi,
  Signal,
  UserCog,
  Network,
  Activity,
  Settings2,
  Store,
  Receipt,
  MessageSquare,
  BotMessageSquare,
  ChevronRight,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/sidebar-context"
import { X } from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
  adminOnly?: boolean
  defaultOpen?: boolean
}

const STORAGE_KEY = "sidebar-groups"

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    defaultOpen: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "AI Assistant", href: "/chat", icon: Bot },
    ],
  },
  {
    label: "Hotspot",
    items: [
      { label: "Users", href: "/hotspot/users", icon: Wifi },
      { label: "Active Sessions", href: "/hotspot/active", icon: Signal },
      { label: "User Profiles", href: "/hotspot/profiles", icon: UserCog },
    ],
  },
  {
    label: "PPP",
    items: [
      { label: "PPP Users", href: "/ppp/secrets", icon: Network },
      { label: "Active Sessions", href: "/ppp/active", icon: Activity },
      { label: "PPP Profiles", href: "/ppp/profiles", icon: Settings2 },
    ],
  },
  {
    label: "Reseller",
    items: [
      { label: "Reseller List", href: "/resellers", icon: Store },
      { label: "Voucher History", href: "/resellers/vouchers", icon: Receipt },
      { label: "Reseller Bot", href: "/resellers/bot", icon: BotMessageSquare },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Routers", href: "/routers", icon: Router },
      { label: "Users", href: "/users", icon: Users, adminOnly: true },
      { label: "Logs", href: "/logs", icon: Terminal },
      { label: "Communication", href: "/communication", icon: MessageSquare },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: UserCircle },
      { label: "Plan", href: "/plan", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
      { label: "Docs", href: "/docs", icon: BookOpen },
    ],
  },
]

function loadOpenState(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveOpenState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

interface PlanInfo {
  plan: string
  tokenLimit: number
  tokensUsed: number
  status: string
}

function usePlanInfo() {
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  useEffect(() => {
    fetch("/api/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subscription) {
          setPlan({
            plan: data.subscription.plan,
            tokenLimit: data.subscription.tokenLimit,
            tokensUsed: data.usage.totalIn + data.usage.totalOut,
            status: data.subscription.status,
          })
        }
      })
      .catch(() => {})
  }, [])
  return plan
}

function formatTokens(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function CollapsibleGroup({
  group,
  isAdmin,
  pathname,
  isOpen,
  onToggle,
  onNavClick,
}: {
  group: NavGroup
  isAdmin: boolean
  pathname: string
  isOpen: boolean
  onToggle: () => void
  onNavClick: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)
  const isAlwaysOpen = group.defaultOpen === true

  const filteredItems = group.items.filter(
    (item) => !item.adminOnly || isAdmin
  )

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setMaxHeight(contentRef.current.scrollHeight)
    }
  }, [filteredItems.length])

  if (filteredItems.length === 0) return null

  return (
    <div>
      {/* Group header */}
      {isAlwaysOpen ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-4 mb-1">
          {group.label}
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="flex items-center w-full text-[10px] font-bold uppercase tracking-widest text-slate-600 px-4 mb-1 hover:text-slate-400 transition-colors duration-200 cursor-pointer"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 mr-1.5 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
          {group.label}
        </button>
      )}

      {/* Group items */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{
          maxHeight: isAlwaysOpen || isOpen ? (maxHeight ?? 1000) : 0,
        }}
      >
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || (pathname?.startsWith(item.href + "/") && !filteredItems.some((o) => o.href !== item.href && o.href.length > item.href.length && pathname?.startsWith(o.href)))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-all duration-300",
                isActive
                  ? "text-cyan-400 border-r-2 border-cyan-400 bg-cyan-950/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, isAdmin } = useAuth()
  const planInfo = usePlanInfo()
  const { isOpen, close } = useSidebar()

  // Determine which groups to show (filter adminOnly groups)
  const visibleGroups = useMemo(
    () => navGroups.filter((g) => !g.adminOnly || isAdmin),
    [isAdmin]
  )

  // Initialize open state: load from localStorage, then auto-open groups with active routes
  const [openState, setOpenState] = useState<Record<string, boolean>>(() => {
    const saved = loadOpenState()
    const initial: Record<string, boolean> = {}
    for (const group of navGroups) {
      if (group.defaultOpen) {
        initial[group.label] = true
        continue
      }
      // If we have a saved value, use it; otherwise default to closed
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
      for (const group of navGroups) {
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
        saveOpenState(next)
        return next
      }
      return prev
    })
  }, [pathname])

  const toggleGroup = useCallback((label: string) => {
    setOpenState((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      saveOpenState(next)
      return next
    })
  }, [])

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-[55] bg-black/50 lg:hidden" onClick={close} />
      )}
    <aside className={cn(
      "flex flex-col fixed left-0 top-0 h-full h-screen w-64 border-r border-cyan-900/20 bg-slate-950 shadow-[0_0_32px_rgba(76,215,246,0.08)] z-[60] transition-transform duration-300",
      isOpen ? "translate-x-0" : "-translate-x-full",
      "lg:translate-x-0"
    )}>
      {/* Mobile close button */}
      <button
        onClick={close}
        className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white lg:hidden"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Logo */}
      <div className="p-6 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center">
            <Brain className="h-5 w-5 text-[#00424f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-br from-cyan-400 to-cyan-600 bg-clip-text text-transparent font-headline">
              MikroTik AI
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
              AI-Driven Network
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-2 overflow-y-auto font-headline text-sm tracking-tight">
        {visibleGroups.map((group, idx) => (
          <div key={group.label}>
            {idx > 0 && (
              <div className="border-t border-white/5 my-2" />
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

      {/* Plan Card */}
      <div className="p-6">
        <Link href="/plan" className="block">
          <div className="p-4 rounded-xl bg-[#131b2e] border border-white/5 hover:border-[#4cd7f6]/20 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className={cn("h-5 w-5", planInfo?.plan === "ENTERPRISE" ? "text-[#4ae176]" : planInfo?.plan === "PRO" ? "text-[#4cd7f6]" : "text-slate-400")} />
              <span className="text-xs font-headline font-bold text-[#dae2fd]">
                {planInfo ? `AI AGENT ${planInfo.plan}` : "AI AGENT"}
              </span>
            </div>
            {planInfo ? (
              <>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      planInfo.tokensUsed / planInfo.tokenLimit > 0.9 ? "bg-[#ffb4ab]"
                        : planInfo.tokensUsed / planInfo.tokenLimit > 0.7 ? "bg-amber-400"
                        : "bg-[#4cd7f6]"
                    )}
                    style={{ width: `${Math.min((planInfo.tokensUsed / planInfo.tokenLimit) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] mt-2 text-slate-400">
                  Tokens: {formatTokens(planInfo.tokensUsed)} / {formatTokens(planInfo.tokenLimit)}
                </p>
              </>
            ) : (
              <>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden animate-pulse" />
                <p className="text-[10px] mt-2 text-slate-500">Loading...</p>
              </>
            )}
          </div>
        </Link>
      </div>
    </aside>
    </>
  )
}
