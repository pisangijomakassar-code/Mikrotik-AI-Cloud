"use client"

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
  MessageSquare,
  BookOpen,
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
  { label: "AI Assistant", href: "/chat", icon: MessageSquare },
  { label: "Logs", href: "/logs", icon: Terminal },
  { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
  { label: "Docs", href: "/docs", icon: BookOpen },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, isAdmin } = useAuth()

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

      {/* AI Agent Pro Card */}
      <div className="p-6">
        <div className="p-4 rounded-xl bg-[#131b2e] border border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="h-5 w-5 text-[#4ae176]" />
            <span className="text-xs font-headline font-bold text-[#dae2fd]">AI AGENT PRO</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-[#4cd7f6] w-2/3" />
          </div>
          <p className="text-[10px] mt-2 text-slate-400">Tokens: 14.2k / 20k</p>
        </div>
      </div>
    </aside>
  )
}
