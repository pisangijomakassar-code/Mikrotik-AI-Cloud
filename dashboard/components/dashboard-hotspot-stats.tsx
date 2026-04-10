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
            className="p-4 rounded-xl"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-16 rounded bg-[#222a3d]" />
              <div className="h-6 w-10 rounded bg-[#222a3d]" />
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
          className="p-4 rounded-xl relative overflow-hidden group"
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <card.icon className="h-7 w-7" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`p-1.5 rounded-lg ${card.bgGlow}`}>
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
            </div>
            <p className="text-[10px] font-headline text-slate-400 uppercase tracking-widest">
              {card.label}
            </p>
          </div>
          <h3 className="text-2xl font-bold font-headline text-[#dae2fd] ml-1">
            {card.value}
          </h3>
        </div>
      ))}
    </div>
  )
}
