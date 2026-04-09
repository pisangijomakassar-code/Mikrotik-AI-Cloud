"use client"

import { StatsCards } from "@/components/stats-cards"
import { ActivityFeed } from "@/components/activity-feed"
import { RouterStatusCards } from "@/components/router-status-cards"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      {/* Overview Cards */}
      <StatsCards />

      {/* Main Bento Grid */}
      <div className="grid grid-cols-12 gap-8 mt-8">
        {/* Left: System Overview & Stats */}
        <div className="col-span-12 lg:col-span-7 space-y-8">
          {/* Network Throughput Chart */}
          <div className="bg-[#131b2e] p-8 rounded-xl border border-white/[0.02]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-headline text-lg font-bold text-[#dae2fd]">Network Throughput</h3>
                <p className="text-xs text-slate-500">Real-time aggregate data flow across all routers</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-[#2d3449] rounded-lg text-[10px] text-[#4cd7f6] font-bold">1H</span>
                <span className="px-3 py-1 text-[10px] text-slate-500 font-bold">24H</span>
              </div>
            </div>
            <div className="h-64 flex items-end gap-2 relative">
              {/* Abstract Chart Bars */}
              <div className="flex-1 bg-cyan-900/20 rounded-t h-1/3" />
              <div className="flex-1 bg-cyan-900/30 rounded-t h-1/2" />
              <div className="flex-1 bg-[#4cd7f6]/40 rounded-t h-2/3 border-t border-[#4cd7f6]/50" />
              <div className="flex-1 bg-[#4cd7f6]/20 rounded-t h-3/4" />
              <div className="flex-1 bg-[#4cd7f6]/60 rounded-t h-1/2 border-t border-[#4cd7f6]/50" />
              <div className="flex-1 bg-[#4cd7f6]/80 rounded-t h-full border-t border-[#4cd7f6]/50 shadow-[0_0_20px_rgba(76,215,246,0.2)]" />
              <div className="flex-1 bg-[#4cd7f6]/40 rounded-t h-3/4" />
              <div className="flex-1 bg-cyan-900/20 rounded-t h-1/2" />
              <div className="flex-1 bg-cyan-900/30 rounded-t h-2/3" />
              <div className="flex-1 bg-[#4cd7f6]/40 rounded-t h-1/2" />
              <div className="flex-1 bg-[#4cd7f6]/10 rounded-t h-1/3" />
              {/* Data Point Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-2 bg-[#2d3449] border border-[#4cd7f6]/30 rounded-lg text-center backdrop-blur-sm">
                <p className="text-[10px] text-slate-400 font-headline uppercase">Peak Load</p>
                <p className="text-xs font-bold text-[#4cd7f6] font-mono-tech">1.2 Gbps</p>
              </div>
            </div>
          </div>

          {/* Router Status Grid */}
          <RouterStatusCards />
        </div>

        {/* Right: Activity Feed (Glass Card) */}
        <div className="col-span-12 lg:col-span-5">
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
