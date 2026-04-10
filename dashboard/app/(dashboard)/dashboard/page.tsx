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
      <StatsCards />

      <div className="grid grid-cols-12 gap-8 mt-8">
        <div className="col-span-12 lg:col-span-7 space-y-8">
          <NetworkThroughput />
          <RouterStatusCards />
        </div>

        <div className="col-span-12 lg:col-span-5">
          <ActivityFeed />
        </div>
      </div>

      {/* Hotspot Stats */}
      <div className="mt-8">
        <h3 className="text-xs font-headline font-bold text-slate-400 uppercase tracking-widest mb-4">
          Hotspot Overview
        </h3>
        <DashboardHotspotStats />
      </div>

      {/* Warnings + AI Insight */}
      <div className="grid grid-cols-12 gap-8 mt-8">
        <div className="col-span-12 lg:col-span-5">
          <DashboardWarnings />
        </div>
        <div className="col-span-12 lg:col-span-7">
          <DashboardAIInsight />
        </div>
      </div>
    </div>
  )
}
