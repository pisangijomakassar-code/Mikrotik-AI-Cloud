"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Terminal, Wifi, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/logs", label: "All Activity", icon: Terminal },
  { href: "/logs/hotspot", label: "Hotspot Log", icon: Wifi },
  { href: "/logs/user", label: "User Log", icon: UserCog },
] as const

export function LogsTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 mb-6 border-b border-border/30">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
