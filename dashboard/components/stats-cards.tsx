"use client"

import { Users, Router, Wifi, Bot } from "lucide-react"
import { useStats } from "@/hooks/use-stats"

export function StatsCards() {
  const { data: stats, isLoading } = useStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#131b2e] p-6 rounded-xl">
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Card 1: Active Users */}
      <div className="bg-[#131b2e] p-6 rounded-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Users className="h-9 w-9" />
        </div>
        <p className="text-xs font-headline text-slate-400 uppercase tracking-widest mb-1">Active Users</p>
        <h2 className="text-4xl font-bold font-headline text-[#dae2fd]">{stats?.activeUsers ?? 0}</h2>
        <p className="text-[10px] text-slate-500 mt-2 font-mono-tech">of {stats?.totalUsers ?? 0} total users</p>
      </div>

      {/* Card 2: Total Routers */}
      <div className="bg-[#131b2e] p-6 rounded-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Router className="h-9 w-9" />
        </div>
        <p className="text-xs font-headline text-slate-400 uppercase tracking-widest mb-1">Total Routers</p>
        <h2 className="text-4xl font-bold font-headline text-[#dae2fd]">{stats?.totalRouters ?? 0}</h2>
        <p className="text-[10px] text-slate-500 mt-2 font-mono-tech">{stats?.totalLogs ?? 0} total logs</p>
      </div>

      {/* Card 3: Active Clients */}
      <div className="bg-[#131b2e] p-6 rounded-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Wifi className="h-9 w-9" />
        </div>
        <p className="text-xs font-headline text-slate-400 uppercase tracking-widest mb-1">Recent Activity</p>
        <h2 className="text-4xl font-bold font-headline text-[#dae2fd]">{stats?.recentActivity ?? 0}</h2>
        <div className="flex gap-1 mt-2">
          <div className="h-1 w-full bg-[#06b6d4] rounded-full" />
          <div className="h-1 w-12 bg-[#2d3449] rounded-full" />
        </div>
      </div>

      {/* Card 4: LLM Status */}
      <div className="bg-[#131b2e] p-6 rounded-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Bot className="h-9 w-9" />
        </div>
        <p className="text-xs font-headline text-slate-400 uppercase tracking-widest mb-1">LLM Status</p>
        <div className="flex items-center gap-3">
          <h2 className="text-4xl font-bold font-headline text-[#dae2fd]">Ready</h2>
          <div className="px-2 py-1 bg-[#4ae176]/10 border border-[#4ae176]/20 rounded-lg text-[10px] text-[#4ae176] font-bold animate-pulse">
            OPTIMIZED
          </div>
        </div>
      </div>
    </div>
  )
}
