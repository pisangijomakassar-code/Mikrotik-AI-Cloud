export type PlanKey = "FREE" | "PRO" | "PREMIUM"

export interface PlanLimits {
  dailyTokenLimit: number // -1 = unlimited
  maxRouters: number
  allowedTunnelPorts: string[] // which tunnel service names can be enabled
  label: string
  color: string
  features: string[]
  priceIdr: number // 0 = free
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  FREE: {
    dailyTokenLimit: 100,
    maxRouters: 1,
    allowedTunnelPorts: ["api"],
    label: "Free",
    color: "text-slate-400",
    priceIdr: 0,
    features: [
      "100 tokens/day",
      "1 MikroTik device",
      "Dashboard, Hotspot, PPP, Reseller",
      "Tunnel (API port only)",
      "Support via Sosmed (YT/IG/FB)",
    ],
  },
  PRO: {
    dailyTokenLimit: 1000,
    maxRouters: 2,
    allowedTunnelPorts: ["api", "winbox", "ssh", "webfig", "api-ssl"],
    label: "Pro",
    color: "text-[#4cd7f6]",
    priceIdr: 99000,
    features: [
      "1,000 tokens/day",
      "Up to 2 MikroTik devices",
      "Dashboard, Hotspot, PPP, Reseller",
      "Tunnel (all ports)",
      "Support via Telegram or WhatsApp",
    ],
  },
  PREMIUM: {
    dailyTokenLimit: -1,
    maxRouters: 5,
    allowedTunnelPorts: ["api", "winbox", "ssh", "webfig", "api-ssl"],
    label: "Premium",
    color: "text-[#4ae176]",
    priceIdr: 199000,
    features: [
      "Unlimited tokens/day",
      "Up to 5 MikroTik devices",
      "Dashboard, Hotspot, PPP, Reseller",
      "Tunnel (all ports)",
      "Support via Telegram or WhatsApp",
      "User Management & Communication",
      "WhatsApp integration",
      "Online payment integration",
    ],
  },
}
