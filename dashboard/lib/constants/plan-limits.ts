export type PlanKey = "FREE" | "PRO" | "PREMIUM"

export interface PlanLimits {
  dailyTokenLimit: number // -1 = unlimited
  maxRouters: number
  label: string
  color: string
  features: string[]
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  FREE: {
    dailyTokenLimit: 100,
    maxRouters: 1,
    label: "Free",
    color: "text-slate-400",
    features: [
      "100 tokens/day",
      "1 router",
      "Basic AI assistant",
      "Community support",
    ],
  },
  PRO: {
    dailyTokenLimit: 1000,
    maxRouters: 2,
    label: "Pro",
    color: "text-[#4cd7f6]",
    features: [
      "1,000 tokens/day",
      "2 routers",
      "Advanced AI assistant",
      "Priority support",
    ],
  },
  PREMIUM: {
    dailyTokenLimit: -1,
    maxRouters: 5,
    label: "Premium",
    color: "text-[#4ae176]",
    features: [
      "Unlimited tokens",
      "5 routers",
      "Full AI suite",
      "Dedicated support",
      "Communication panel",
    ],
  },
}
