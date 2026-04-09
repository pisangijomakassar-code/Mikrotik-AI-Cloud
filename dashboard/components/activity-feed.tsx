"use client"

import { ScrollText, CheckCircle2, XCircle, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLogs } from "@/hooks/use-logs"
import { cn } from "@/lib/utils"

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  if (status === "error") return <XCircle className="h-4 w-4 text-red-400" />
  return <Clock className="h-4 w-4 text-amber-400" />
}

export function ActivityFeed() {
  const { data, isLoading } = useLogs({ pageSize: 10, page: 1 })

  return (
    <Card className="border-0 rounded-lg" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[380px] pr-3">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-4 w-4 rounded-full bg-muted mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.data?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No recent activity
            </p>
          ) : (
            <div className="space-y-1">
              {data.data.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid rgba(61, 73, 76, 0.08)' }}
                >
                  <StatusIcon status={log.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {log.user?.name || "System"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px] px-1.5 py-0 border-0",
                          log.action === "read" && "bg-blue-500/10 text-blue-400",
                          log.action === "write" && "bg-amber-500/10 text-amber-400",
                          log.action === "admin" && "bg-purple-500/10 text-purple-400"
                        )}
                      >
                        {log.action}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {log.router?.name && (
                        <span style={{ fontFamily: 'var(--font-technical)' }}>{log.router.name}</span>
                      )}
                      {log.tool && (
                        <>
                          <span className="text-muted-foreground/50">|</span>
                          <span>{log.tool}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-technical)' }}>
                    {formatTimeAgo(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
