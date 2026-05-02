import {
  LayoutDashboard,
  Building2,
  Clock,
  Sparkles,
  Ban,
  CreditCard,
  Receipt,
  Repeat,
  Tags,
  TrendingUp,
  Gauge,
  Server,
  Cog,
  AlertTriangle,
  ShieldCheck,
  HeartPulse,
  Megaphone,
  Wrench,
  Bot,
  Mail,
  Send,
  Flag,
  History,
  UserCircle,
} from "lucide-react"
import type { NavGroup } from "./nav-config"

// Sidebar khusus SUPER_ADMIN — POV platform/SaaS console.
// Akses lintas-tenant; tidak ada Active Router atau Plan Card.
// Semua menu di sini placeholder Phase 3 — implementasi bertahap di Phase 4.
export const navGroupsPlatform: NavGroup[] = [
  {
    label: "Overview",
    defaultOpen: true,
    items: [
      { label: "Platform Dashboard", href: "/platform/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Tenants",
    defaultOpen: true,
    items: [
      { label: "All Tenants", href: "/platform/tenants", icon: Building2 },
      { label: "Expiring Soon", href: "/platform/tenants/expiring", icon: Clock },
      { label: "Trials", href: "/platform/tenants/trials", icon: Sparkles },
      { label: "Suspended", href: "/platform/tenants/suspended", icon: Ban },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Invoices", href: "/platform/billing/invoices", icon: Receipt },
      { label: "Subscriptions", href: "/platform/billing/subscriptions", icon: Repeat },
      { label: "Plans & Pricing", href: "/platform/billing/plans", icon: Tags },
      { label: "Revenue Reports", href: "/platform/billing/revenue", icon: TrendingUp },
    ],
  },
  {
    label: "Usage",
    items: [
      { label: "Per-Tenant Usage", href: "/platform/usage", icon: Gauge },
      { label: "System Resources", href: "/platform/usage/resources", icon: Server },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Background Jobs", href: "/platform/system/jobs", icon: Cog },
      { label: "Error Logs", href: "/platform/system/errors", icon: AlertTriangle },
      { label: "Audit Log", href: "/platform/system/audit", icon: ShieldCheck },
      { label: "Health Check", href: "/platform/system/health", icon: HeartPulse },
    ],
  },
  {
    label: "Broadcast",
    items: [
      { label: "Announcements", href: "/platform/broadcast/announcements", icon: Megaphone },
      { label: "Maintenance Notice", href: "/platform/broadcast/maintenance", icon: Wrench },
    ],
  },
  {
    label: "Platform Settings",
    items: [
      { label: "Global LLM Default", href: "/platform/settings/llm-default", icon: Bot },
      { label: "Email/SMS Gateway", href: "/platform/settings/gateway", icon: Mail },
      { label: "Telegram Bot Config", href: "/platform/settings/telegram", icon: Send },
      { label: "Feature Flags", href: "/platform/settings/flags", icon: Flag },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Tenant Activity", href: "/platform/support/activity", icon: History },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/platform/profile", icon: UserCircle },
    ],
  },
]
