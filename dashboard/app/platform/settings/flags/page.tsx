"use client"

import { useEffect, useState, useCallback } from "react"
import { Switch } from "@/components/ui/switch"
import { Flag, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"

interface FeatureFlag {
  key: string
  description: string
  enabled: boolean
  updatedAt: string
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/flags")
      if (res.ok) setFlags(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(key: string, enabled: boolean) {
    setToggling(key)
    try {
      const res = await fetch(`/api/platform/flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (res.ok) {
        setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f))
        toast.success(`${key} ${enabled ? "enabled" : "disabled"}`)
      } else {
        toast.error("Failed to update flag")
      }
    } finally { setToggling(null) }
  }

  const enabledCount = flags.filter(f => f.enabled).length

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
            <Flag className="h-7 w-7 text-[#4cd7f6]" /> Feature Flags
          </h2>
          <p className="text-muted-foreground">
            {loading ? "Loading…" : `${enabledCount} of ${flags.length} flags enabled`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="card-glass rounded-2xl divide-y divide-white/[0.05]">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : flags.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No flags defined</div>
        ) : (
          flags.map((flag) => (
            <div key={flag.key} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono font-semibold text-[#4cd7f6]">{flag.key}</code>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    flag.enabled
                      ? "bg-[#4ae176]/15 text-[#4ae176]"
                      : "bg-zinc-500/15 text-zinc-400"
                  }`}>
                    {flag.enabled ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
                <p className="text-[10px] text-[#869397] mt-1">
                  Last updated: {format(new Date(flag.updatedAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              <Switch
                checked={flag.enabled}
                disabled={toggling === flag.key}
                onCheckedChange={(v) => toggle(flag.key, v)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
