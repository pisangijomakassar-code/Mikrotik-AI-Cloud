"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Server, Cpu, MemoryStick, RefreshCw, Activity } from "lucide-react"

interface ResourceData {
  uptime: number; platform: string; arch: string; nodeVersion: string
  cpu: { model: string; cores: number; avgLoadPercent: number }
  memory: { totalBytes: number; usedBytes: number; freeBytes: number; usedPercent: number }
  process: { heapUsedBytes: number; heapTotalBytes: number; rssBytes: number; externalBytes: number }
  loadAvg: number[]
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function GaugeBar({ percent, color = "#4cd7f6" }: { percent: number; color?: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default function SystemResourcesPage() {
  const [data, setData] = useState<ResourceData | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch("/api/platform/system/resources")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const memColor = data
    ? data.memory.usedPercent > 85 ? "#f87171" : data.memory.usedPercent > 60 ? "#fb923c" : "#4cd7f6"
    : "#4cd7f6"
  const cpuColor = data
    ? data.cpu.avgLoadPercent > 80 ? "#f87171" : data.cpu.avgLoadPercent > 60 ? "#fb923c" : "#4ae176"
    : "#4ae176"

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
            <Server className="h-7 w-7 text-[#4cd7f6]" /> System Resources
          </h2>
          <p className="text-muted-foreground">Server CPU, memory, and Node.js process stats</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : !data ? (
        <div className="py-12 text-center text-muted-foreground">Failed to load resource data</div>
      ) : (
        <div className="space-y-6">
          {/* Server info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Platform", value: `${data.platform} (${data.arch})` },
              { label: "Node", value: data.nodeVersion },
              { label: "Uptime", value: fmtUptime(data.uptime) },
              { label: "CPU Cores", value: String(data.cpu.cores) },
            ].map(({ label, value }) => (
              <div key={label} className="card-glass rounded-xl p-4">
                <p className="text-xs text-[#869397] mb-1">{label}</p>
                <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* CPU */}
          <div className="card-glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4 text-[#4ae176]" />
              <h3 className="text-sm font-semibold text-foreground">CPU</h3>
            </div>
            <p className="text-xs text-[#869397] mb-3 truncate">{data.cpu.model}</p>
            <div className="flex items-center gap-4">
              <GaugeBar percent={data.cpu.avgLoadPercent} color={cpuColor} />
              <span className="text-sm font-mono font-bold shrink-0" style={{ color: cpuColor }}>
                {data.cpu.avgLoadPercent}%
              </span>
            </div>
            {data.loadAvg.length >= 3 && (
              <p className="text-xs text-[#869397] mt-2">
                Load avg: {data.loadAvg.map(v => v.toFixed(2)).join(" / ")} (1m / 5m / 15m)
              </p>
            )}
          </div>

          {/* Memory */}
          <div className="card-glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MemoryStick className="h-4 w-4 text-[#4cd7f6]" />
              <h3 className="text-sm font-semibold text-foreground">System Memory</h3>
            </div>
            <div className="flex items-center gap-4 mb-2">
              <GaugeBar percent={data.memory.usedPercent} color={memColor} />
              <span className="text-sm font-mono font-bold shrink-0" style={{ color: memColor }}>
                {data.memory.usedPercent}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              {[
                { label: "Used", value: fmtBytes(data.memory.usedBytes) },
                { label: "Free", value: fmtBytes(data.memory.freeBytes) },
                { label: "Total", value: fmtBytes(data.memory.totalBytes) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-xs text-[#869397]">{label}</p>
                  <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Node.js process */}
          <div className="card-glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-[#4cd7f6]" />
              <h3 className="text-sm font-semibold text-foreground">Node.js Process</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Heap Used", value: fmtBytes(data.process.heapUsedBytes) },
                { label: "Heap Total", value: fmtBytes(data.process.heapTotalBytes) },
                { label: "RSS", value: fmtBytes(data.process.rssBytes) },
                { label: "External", value: fmtBytes(data.process.externalBytes) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/[0.03] p-3">
                  <p className="text-xs text-[#869397] mb-1">{label}</p>
                  <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
