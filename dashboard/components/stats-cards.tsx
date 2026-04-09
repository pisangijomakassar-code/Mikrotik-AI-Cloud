"use client"

import { Users, Router, Wifi, Activity, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useStats } from "@/hooks/use-stats"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  description?: string
  trend?: { value: string; positive: boolean }
  badge?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
}

function StatCard({ title, value, icon: Icon, description, trend, badge }: StatCardProps) {
  return (
    <Card className="border-0 transition-colors rounded-lg" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
      <CardContent className="pt-0">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
              {trend && (
                <span className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  trend.positive ? "text-[#4ae176]" : "text-[#ffb4ab]"
                )}>
                  {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trend.value}
                </span>
              )}
              {badge && (
                <Badge
                  variant={badge.variant}
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-semibold",
                    badge.variant === "default" && "bg-[#4ae176]/10 text-[#4ae176] border-[#4ae176]/20",
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
          <Card key={i} className="border-0" style={{ background: 'rgba(45, 52, 73, 0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
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
        trend={{ value: "+12%", positive: true }}
        description={`${stats?.totalUsers ?? 0} total registered`}
      />
      <StatCard
        title="Total Routers"
        value={stats?.totalRouters ?? 0}
        icon={Router}
        description="Cluster usage across all users"
      />
      <StatCard
        title="Active Clients"
        value={stats?.recentActivity ?? 0}
        icon={Wifi}
        description="Connected in last 24h"
      />
      <StatCard
        title="LLM Status"
        value="Ready"
        icon={Activity}
        badge={{ label: "OPTIMIZED", variant: "default" }}
        description={`${stats?.totalLogs ?? 0} total logs`}
      />
    </div>
  )
}
