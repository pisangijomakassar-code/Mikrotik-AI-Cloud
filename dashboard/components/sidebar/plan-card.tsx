"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlanInfo {
  plan: string
  tokenLimit: number
  tokensUsed: number
  status: string
}

function usePlanInfo() {
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  useEffect(() => {
    fetch("/api/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subscription) {
          setPlan({
            plan: data.subscription.plan,
            tokenLimit: data.subscription.tokenLimit,
            tokensUsed: data.usage.totalIn + data.usage.totalOut,
            status: data.subscription.status,
          })
        }
      })
      .catch(() => {})
  }, [])
  return plan
}

function formatTokens(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function PlanCard() {
  const planInfo = usePlanInfo()

  return (
    <div className="p-6">
      <Link href="/plan" className="block">
        <div className="p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className={cn("h-5 w-5", planInfo?.plan === "PREMIUM" ? "text-[#4ae176]" : planInfo?.plan === "PRO" ? "text-[#4cd7f6]" : "text-muted-foreground")} />
            <span className="text-xs font-headline font-bold text-foreground">
              {planInfo ? `AI AGENT ${planInfo.plan}` : "AI AGENT"}
            </span>
          </div>
          {planInfo ? (
            <>
              <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    planInfo.tokenLimit === -1
                      ? "bg-[#4cd7f6]"
                      : planInfo.tokensUsed / planInfo.tokenLimit > 0.9 ? "bg-[#ffb4ab]"
                      : planInfo.tokensUsed / planInfo.tokenLimit > 0.7 ? "bg-amber-400"
                      : "bg-[#4cd7f6]"
                  )}
                  style={{
                    width: planInfo.tokenLimit === -1
                      ? "0%"
                      : `${Math.min((planInfo.tokensUsed / planInfo.tokenLimit) * 100, 100)}%`
                  }}
                />
              </div>
              <p className="text-[10px] mt-2 text-muted-foreground">
                {planInfo.tokenLimit === -1
                  ? `Tokens: ${formatTokens(planInfo.tokensUsed)} / ∞`
                  : `Tokens: ${formatTokens(planInfo.tokensUsed)} / ${formatTokens(planInfo.tokenLimit)}`}
              </p>
            </>
          ) : (
            <>
              <div className="h-1.5 w-full bg-background rounded-full overflow-hidden animate-pulse" />
              <p className="text-[10px] mt-2 text-muted-foreground/70">Loading...</p>
            </>
          )}
        </div>
      </Link>
    </div>
  )
}
