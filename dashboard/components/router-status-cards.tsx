"use client"

import { Cpu, HardDrive } from "lucide-react"
import { useRouters } from "@/hooks/use-routers"

export function RouterStatusCards() {
  const { data: routers, isLoading } = useRouters()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-5 bg-[#131b2e] rounded-xl border border-white/[0.02] animate-pulse">
            <div className="h-4 w-20 rounded bg-[#222a3d] mb-2" />
            <div className="h-6 w-12 rounded bg-[#222a3d]" />
          </div>
        ))}
      </div>
    )
  }

  // Calculate aggregate stats from routers
  const onlineRouters = routers?.filter((r) => r.health?.status === "online") ?? []
  const avgCpu = onlineRouters.length > 0
    ? Math.round(onlineRouters.reduce((acc, r) => acc + (r.health?.cpuLoad ?? 0), 0) / onlineRouters.length)
    : 0
  const totalMemFree = onlineRouters.reduce((acc, r) => {
    if (r.health) {
      return acc + (r.health.memoryTotal - r.health.memoryUsed)
    }
    return acc
  }, 0)
  const memFreeGB = (totalMemFree / 1024 / 1024 / 1024).toFixed(1)

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* CPU Load */}
      <div className="p-5 bg-[#131b2e] rounded-xl border border-white/[0.02] flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-500 font-headline uppercase mb-1">CPU Load</p>
          <p className="text-xl font-bold font-mono-tech text-[#dae2fd]">{avgCpu}%</p>
        </div>
        <div className="w-12 h-12 rounded-full border-2 border-[#4cd7f6]/20 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#4cd7f6] animate-pulse shadow-[0_0_10px_#4cd7f6]" />
        </div>
      </div>

      {/* Memory Free */}
      <div className="p-5 bg-[#131b2e] rounded-xl border border-white/[0.02] flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-500 font-headline uppercase mb-1">Memory Free</p>
          <p className="text-xl font-bold font-mono-tech text-[#dae2fd]">{memFreeGB} GB</p>
        </div>
        <div className="w-12 h-12 rounded-full border-2 border-[#4ae176]/20 flex items-center justify-center">
          <HardDrive className="h-5 w-5 text-[#4ae176]" />
        </div>
      </div>
    </div>
  )
}
