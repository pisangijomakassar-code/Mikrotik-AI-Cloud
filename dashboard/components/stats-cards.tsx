"use client"

import { Users, Router, Wifi, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useStats } from "@/hooks/use-stats"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  description?: string
  badge?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
}

function StatCard({ title, value, icon: Icon, description, badge }: StatCardProps) {
  return (
    <Card className="border-border bg-card hover:border-primary/30 transition-colors">
      <CardContent className="pt-0">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground">{value}</p>
              {badge && (
                <Badge
                  variant={badge.variant}
                  className={cn(
                    badge.variant === "default" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    badge.variant === "destructive" && "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  {badge.label}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatsCards() {
  const { data: stats, isLoading } = useStats()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="pt-0">
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-8 w-16 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Active Users"
        value={stats?.activeUsers ?? 0}
        icon={Users}
        description={`${stats?.totalUsers ?? 0} total registered`}
      />
      <StatCard
        title="Routers Managed"
        value={stats?.totalRouters ?? 0}
        icon={Router}
        description="Across all users"
      />
      <StatCard
        title="Total Activity"
        value={stats?.recentActivity ?? 0}
        icon={Wifi}
        description="Actions in last 24h"
      />
      <StatCard
        title="System Status"
        value="Online"
        icon={Activity}
        badge={{ label: "Healthy", variant: "default" }}
        description={`${stats?.totalLogs ?? 0} total logs`}
      />
    </div>
  )
}
