"use client"

import { StatsCards } from "@/components/stats-cards"
import { ActivityFeed } from "@/components/activity-feed"
import { RouterStatusCards } from "@/components/router-status-cards"

export default function DashboardPage() {
  return (
    <div>
      {/* Overview Cards */}
      <StatsCards />

      {/* Main Bento Grid */}
      <div className="grid grid-cols-12 gap-8 mt-8">
        {/* Left: System Overview & Stats */}
        <div className="col-span-12 lg:col-span-7 space-y-8">
          {/* Network Throughput Placeholder */}
          <div
            className="rounded-xl p-8"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-headline text-lg font-bold text-[#dae2fd]">
                  Network Throughput
                </h3>
                <p className="text-xs text-slate-500">
                  Aggregate data flow across all routers
                </p>
              </div>
            </div>
            <div className="h-48 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#4cd7f6]/10 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-[#4cd7f6]/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No chart data available</p>
              <p className="text-[10px] text-slate-600">
                Data will appear here once routers begin reporting traffic
              </p>
            </div>
          </div>

          {/* Router Status Grid */}
          <RouterStatusCards />
        </div>

        {/* Right: Activity Feed */}
        <div className="col-span-12 lg:col-span-5">
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
