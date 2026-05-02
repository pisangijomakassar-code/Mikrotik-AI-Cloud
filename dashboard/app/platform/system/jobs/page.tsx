"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Cog, RefreshCw, Clock, CheckCircle2, HelpCircle } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

interface Job {
  key: string; name: string; schedule: string; description: string; lastRun: string | null
}

export default function BackgroundJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch("/api/platform/system/jobs")
      .then(r => r.ok ? r.json() : [])
      .then(setJobs)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
            <Cog className="h-7 w-7 text-[#4cd7f6]" /> Background Jobs
          </h2>
          <p className="text-muted-foreground">
            {loading ? "Loading…" : `${jobs.length} registered cron jobs`}
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
        ) : (
          jobs.map(job => (
            <div key={job.key} className="p-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{job.name}</span>
                    <code className="text-[10px] text-[#869397] font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">
                      {job.key}
                    </code>
                  </div>
                  <p className="text-xs text-[#869397] mb-2">{job.description}</p>
                  <div className="flex items-center gap-4 text-xs text-[#869397]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.schedule}
                    </span>
                    {job.lastRun ? (
                      <span className="flex items-center gap-1 text-[#4ae176]">
                        <CheckCircle2 className="h-3 w-3" />
                        Last run {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                        <span className="text-[#869397]">({format(new Date(job.lastRun), "dd MMM HH:mm")})</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-zinc-500">
                        <HelpCircle className="h-3 w-3" />
                        Never run
                      </span>
                    )}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${job.lastRun ? "bg-[#4ae176]" : "bg-zinc-600"}`} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
