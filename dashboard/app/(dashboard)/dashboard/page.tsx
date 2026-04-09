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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user?.name || "User"}. Here is an overview of your system.
        </p>
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
