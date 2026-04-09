"use client"

import { Users, Router, Wifi, Bot } from "lucide-react"
import { useStats } from "@/hooks/use-stats"

export function StatsCards() {
  const { data: stats, isLoading } = useStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-6 rounded-xl"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-24 rounded bg-[#222a3d]" />
              <div className="h-8 w-16 rounded bg-[#222a3d]" />
              <div className="h-3 w-32 rounded bg-[#222a3d]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-6 rounded-xl relative overflow-hidden group"
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <card.icon className="h-9 w-9" />
          </div>
          <p className="text-xs font-headline text-slate-400 uppercase tracking-widest mb-1">
            {card.label}
          </p>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-bold font-headline text-[#dae2fd]">
              {card.value}
            </h2>
            {card.badge && (
              <div className="px-2 py-1 bg-[#4ae176]/10 border border-[#4ae176]/20 rounded-lg text-[10px] text-[#4ae176] font-bold animate-pulse">
                OPTIMIZED
              </div>
            )}
          </div>
          {card.sub && (
            <p className="text-[10px] text-slate-500 mt-2 font-mono-tech">
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
