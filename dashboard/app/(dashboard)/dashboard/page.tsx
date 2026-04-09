"use client"

import { StatsCards } from "@/components/stats-cards"
import { ActivityFeed } from "@/components/activity-feed"
import { RouterStatusCards } from "@/components/router-status-cards"
import { NetworkThroughput } from "@/components/network-throughput"

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
    </div>
  )
}
