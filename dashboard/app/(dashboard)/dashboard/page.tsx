"use client"

import { StatsCards } from "@/components/stats-cards"
import { ActivityFeed } from "@/components/activity-feed"
import { RouterStatusCards } from "@/components/router-status-cards"
import { NetworkThroughput } from "@/components/network-throughput"
import { DashboardHotspotStats } from "@/components/dashboard-hotspot-stats"
import { DashboardWarnings } from "@/components/dashboard-warnings"
import { DashboardAIInsight } from "@/components/dashboard-ai-insight"

export default function DashboardPage() {
  return (
    <div>
      {/* Row 1: Main Stats */}
      <StatsCards />

      {/* Row 2: Hotspot Overview */}
      <div className="mt-8">
        <h3 className="text-xs font-headline font-bold text-slate-400 uppercase tracking-widest mb-4">
          Hotspot Overview
        </h3>
        <DashboardHotspotStats />
      </div>

      {/* Row 3: Network Throughput + Router Status */}
      <div className="grid grid-cols-12 gap-8 mt-8">
        <div className="col-span-12 lg:col-span-7">
          <NetworkThroughput />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <RouterStatusCards />
        </div>
      </div>

      {/* Row 4: Network Alerts + AI Insight (stacked, same section) */}
      <div className="mt-8 space-y-6">
        <DashboardWarnings />
        <DashboardAIInsight />
      </div>

      {/* Row 5: Activity Feed */}
      <div className="mt-8">
        <ActivityFeed />
      </div>
    </div>
  )
}
