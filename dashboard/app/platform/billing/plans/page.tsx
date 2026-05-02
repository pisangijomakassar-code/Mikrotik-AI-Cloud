"use client"

import { CheckCircle2, Zap, Router, Users, Bot, RefreshCw } from "lucide-react"

const PLANS = [
  {
    name: "FREE",
    price: "Gratis",
    color: "border-zinc-500/30",
    headerColor: "bg-zinc-500/10",
    badge: "bg-zinc-500/15 text-zinc-400",
    features: [
      { icon: Zap, text: "100 AI tokens / bulan" },
      { icon: Router, text: "1 router" },
      { icon: Users, text: "1 user" },
      { icon: Bot, text: "AI Assistant (limited)" },
    ],
    limits: { tokenLimit: 100, routers: 1, users: 1 },
  },
  {
    name: "PRO",
    price: "Rp 150.000 / bulan",
    color: "border-[#4cd7f6]/30",
    headerColor: "bg-[#4cd7f6]/10",
    badge: "bg-[#4cd7f6]/15 text-[#4cd7f6]",
    highlight: true,
    features: [
      { icon: Zap, text: "1.000 AI tokens / bulan" },
      { icon: Router, text: "Up to 5 routers" },
      { icon: Users, text: "Up to 5 users" },
      { icon: Bot, text: "Full AI Assistant" },
      { icon: RefreshCw, text: "Voucher & Reseller module" },
    ],
    limits: { tokenLimit: 1000, routers: 5, users: 5 },
  },
  {
    name: "PREMIUM",
    price: "Rp 350.000 / bulan",
    color: "border-amber-500/30",
    headerColor: "bg-amber-500/10",
    badge: "bg-amber-500/15 text-amber-400",
    features: [
      { icon: Zap, text: "Unlimited AI tokens" },
      { icon: Router, text: "Unlimited routers" },
      { icon: Users, text: "Unlimited users" },
      { icon: Bot, text: "Priority AI Agent" },
      { icon: RefreshCw, text: "All modules" },
      { icon: CheckCircle2, text: "Dedicated support" },
    ],
    limits: { tokenLimit: -1, routers: -1, users: -1 },
  },
]

export default function PlansPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Plans & Pricing</h2>
        <p className="text-muted-foreground">Tier definitions — change tenant plan via Subscriptions page</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`card-glass rounded-2xl border overflow-hidden ${plan.color} ${plan.highlight ? "ring-1 ring-[#4cd7f6]/30" : ""}`}
          >
            <div className={`p-5 ${plan.headerColor}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${plan.badge}`}>
                  {plan.name}
                </span>
                {plan.highlight && (
                  <span className="text-[10px] text-[#4cd7f6] font-semibold">POPULAR</span>
                )}
              </div>
              <p className="font-headline font-bold text-foreground text-lg">{plan.price}</p>
            </div>
            <div className="p-5 space-y-2.5">
              {plan.features.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-[#4cd7f6] shrink-0" />
                  {text}
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <div className="rounded-lg bg-white/[0.03] p-3 space-y-1 text-xs font-mono text-[#869397]">
                <div className="flex justify-between">
                  <span>tokenLimit</span>
                  <span className="text-foreground">{plan.limits.tokenLimit < 0 ? "-1 (∞)" : plan.limits.tokenLimit}</span>
                </div>
                <div className="flex justify-between">
                  <span>maxRouters</span>
                  <span className="text-foreground">{plan.limits.routers < 0 ? "-1 (∞)" : plan.limits.routers}</span>
                </div>
                <div className="flex justify-between">
                  <span>maxUsers</span>
                  <span className="text-foreground">{plan.limits.users < 0 ? "-1 (∞)" : plan.limits.users}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground/50 mt-6">
        To assign a plan to a tenant, go to Billing → Subscriptions and change the plan inline.
      </p>
    </div>
  )
}
