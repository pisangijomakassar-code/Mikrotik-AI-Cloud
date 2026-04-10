"use client"

import { Wifi, Signal, UserCheck, UserX } from "lucide-react"
import { useHotspotStats } from "@/hooks/use-hotspot"

export function DashboardHotspotStats() {
  const { data: stats, isLoading } = useHotspotStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl card-glass"
          >
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-6 w-10 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: "Total Users",
      value: stats?.totalUsers ?? 0,
      icon: Wifi,
      color: "text-cyan-400",
      bgGlow: "bg-cyan-400/10",
    },
    {
      label: "Active Sessions",
      value: stats?.activeSessions ?? 0,
      icon: Signal,
      color: "text-[#4ae176]",
      bgGlow: "bg-[#4ae176]/10",
    },
    {
      label: "Enabled Users",
      value: (stats?.totalUsers ?? 0) - (stats?.disabledUsers ?? 0),
      icon: UserCheck,
      color: "text-[#4ae176]",
      bgGlow: "bg-[#4ae176]/10",
    },
    {
      label: "Disabled Users",
      value: stats?.disabledUsers ?? 0,
      icon: UserX,
      color: "text-[#ffb4ab]",
      bgGlow: "bg-[#ffb4ab]/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-4 rounded-xl relative overflow-hidden group card-glass"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <card.icon className="h-7 w-7" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`p-1.5 rounded-lg ${card.bgGlow}`}>
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
            </div>
            <p className="text-[10px] font-headline text-muted-foreground uppercase tracking-widest">
              {card.label}
            </p>
          </div>
          <h3 className="text-2xl font-bold font-headline text-foreground ml-1">
            {card.value}
          </h3>
        </div>
      ))}
    </div>
  )
}
