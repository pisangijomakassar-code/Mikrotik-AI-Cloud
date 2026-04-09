"use client"

import { LogTable } from "@/components/log-table"

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">
          View all system activity, API calls, and router interactions.
        </p>
      </div>
      <LogTable />
    </div>
  )
}
