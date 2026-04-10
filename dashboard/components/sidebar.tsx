"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Users,
  Router,
  Terminal,
  Settings,
  LogOut,
  Sparkles,
  Brain,
  Bot,
  BookOpen,
  UserCircle,
  CreditCard,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Routers", href: "/routers", icon: Router },
  { label: "Users", href: "/users", icon: Users, adminOnly: true },
  { label: "AI Assistant", href: "/chat", icon: Bot },
  { label: "Logs", href: "/logs", icon: Terminal },
  { label: "Profile", href: "/profile", icon: UserCircle },
  { label: "Plan", href: "/plan", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
  { label: "Docs", href: "/docs", icon: BookOpen },
]

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

export function Sidebar() {
  const pathname = usePathname()
  const { user, isAdmin } = useAuth()
  const planInfo = usePlanInfo()

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  )

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <aside className="flex flex-col fixed left-0 top-0 h-full h-screen w-64 border-r border-cyan-900/20 bg-slate-950 shadow-[0_0_32px_rgba(76,215,246,0.08)] z-50">
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
      <nav className="flex-1 mt-6 px-4 space-y-2 font-headline text-sm tracking-tight">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
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
  )
}
