"use client"

import { Terminal } from "lucide-react"
import { LogTable } from "@/components/log-table"

export default function LogsPage() {
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Activity Logs</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Terminal className="h-[18px] w-[18px] text-[#4cd7f6]" />
            Real-time system logs and activity monitoring.
          </p>
        </div>
      </div>
      <LogTable />
    </div>
  )
}
