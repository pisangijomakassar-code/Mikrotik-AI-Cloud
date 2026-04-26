"use client"

import { Users, Router, Wifi, Bot } from "lucide-react"
import { useStats } from "@/hooks/use-stats"
import { useAuth } from "@/hooks/use-auth"

export function StatsCards() {
  const { data: stats, isLoading } = useStats()
  const { isAdmin } = useAuth()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-6 rounded-xl card-glass"
          >
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = isAdmin
    ? [
        {
          label: "Active Users",
          value: stats?.activeUsers ?? 0,
          sub: `of ${stats?.totalUsers ?? 0} total users`,
          icon: Users,
        },
        {
          label: "Total Routers",
          value: stats?.totalRouters ?? 0,
          sub: `${stats?.totalLogs ?? 0} total logs`,
          icon: Router,
        },
        {
          label: "Recent Activity",
          value: stats?.recentActivity ?? 0,
          sub: "events in last 24h",
          icon: Wifi,
        },
        {
          label: "LLM Status",
          value: "Ready",
          sub: null,
          icon: Bot,
          badge: true,
        },
      ]
    : [
        {
          label: "My Routers",
          value: stats?.totalRouters ?? 0,
          sub: "managed nodes",
          icon: Router,
        },
        {
          label: "My Logs",
          value: stats?.totalLogs ?? 0,
          sub: "total log entries",
          icon: Wifi,
        },
        {
          label: "Recent Activity",
          value: stats?.recentActivity ?? 0,
          sub: "events in last 24h",
          icon: Wifi,
        },
        {
          label: "AI Agent",
          value: "Ready",
          sub: null,
          icon: Bot,
          badge: true,
        },
      ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-6 rounded-xl relative overflow-hidden group card-glass"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <card.icon className="h-9 w-9" />
          </div>
          <p className="text-xs font-headline text-muted-foreground uppercase tracking-widest mb-1">
            {card.label}
          </p>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-bold font-headline text-foreground">
              {card.value}
            </h2>
            {card.badge && (
              <div className="px-2 py-1 bg-[#4ae176]/10 border border-[#4ae176]/20 rounded-lg text-[10px] text-tertiary font-bold animate-pulse">
                OPTIMIZED
              </div>
            )}
          </div>
          {card.sub && (
            <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono-tech">
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
