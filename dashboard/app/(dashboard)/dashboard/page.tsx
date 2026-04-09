"use client"

import { StatsCards } from "@/components/stats-cards"
import { ActivityFeed } from "@/components/activity-feed"
import { RouterStatusCards } from "@/components/router-status-cards"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>Dashboard</h1>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4cd7f6]"
              style={{ background: 'rgba(76, 215, 246, 0.1)', border: '1px solid rgba(76, 215, 246, 0.2)' }}
            >
              AI Agent Pro
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
            Welcome back, {user?.name || "User"}. Here is an overview of your system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md px-3 py-1.5" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)' }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4ae176] shadow-[0_0_6px_rgba(74,225,118,0.4)]" />
            <span className="text-xs text-muted-foreground">API:</span>
            <span className="text-xs font-medium text-[#4ae176]">Online</span>
          </div>
          <div className="flex items-center gap-2 rounded-md px-3 py-1.5" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)' }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4cd7f6] shadow-[0_0_6px_rgba(76,215,246,0.4)]" />
            <span className="text-xs text-muted-foreground">LLM:</span>
            <span className="text-xs font-medium text-[#4cd7f6]">Ready</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Bottom section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityFeed />
        <RouterStatusCards />
      </div>
    </div>
  )
}
