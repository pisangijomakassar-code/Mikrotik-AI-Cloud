"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Users,
  Router,
  ScrollText,
  Settings,
  LogOut,
  Radio,
  MessageSquare,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Users", href: "/users", icon: Users, adminOnly: true },
  { label: "Routers", href: "/routers", icon: Router },
  { label: "Logs", href: "/logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
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
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#0b1326]" style={{ borderRight: '1px solid rgba(61,73,76,0.15)' }}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Radio className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            MikroTik AI
          </span>
          <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>AI-Driven Network</span>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors border-l-2",
                isActive
                  ? "bg-[#131b2e] text-primary border-l-[#4cd7f6]"
                  : "text-muted-foreground hover:bg-[#171f33] hover:text-foreground border-l-transparent"
              )}
            >
              <item.icon
                className={cn("h-4 w-4", isActive ? "text-primary" : "")}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* User section */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.name || "User"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {isAdmin ? "Administrator" : "User"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
