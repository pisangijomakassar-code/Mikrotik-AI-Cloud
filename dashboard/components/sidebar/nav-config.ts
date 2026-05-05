import {
  LayoutDashboard,
  Users,
  Router,
  Terminal,
  Settings,
  Bot,
  BookOpen,
  UserCircle,
  CreditCard,
  Wifi,
  Signal,
  UserCog,
  Network,
  Activity,
  Settings2,
  Store,
  Receipt,
  MessageSquare,
  BotMessageSquare,
  Cable,
  BarChart3,
  History,
  Ticket,
  Zap,
  MessageSquareText,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
  adminOnly?: boolean
  defaultOpen?: boolean
  /** Sembunyikan group ini kalau user belum punya router sama sekali. */
  requiresRouter?: boolean
}

// Mikhmon-style English labels for menu (UX in pages tetap Bahasa Indonesia).
// Multi-tenant: semua menu di sini POV Admin Tenant. Super Admin punya
// sidebar terpisah di app/(platform)/ (Phase 3).
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    defaultOpen: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "AI Assistant", href: "/chat", icon: Bot },
    ],
  },
  {
    label: "Hotspot",
    requiresRouter: true,
    items: [
      { label: "Users", href: "/hotspot/users", icon: Wifi },
      { label: "Active Sessions", href: "/hotspot/active", icon: Signal },
      { label: "User Profiles", href: "/hotspot/profiles", icon: UserCog },
    ],
  },
  {
    label: "PPP",
    requiresRouter: true,
    items: [
      { label: "PPP Secrets", href: "/ppp/secrets", icon: Network },
      { label: "PPP Active", href: "/ppp/active", icon: Activity },
      { label: "PPP Profiles", href: "/ppp/profiles", icon: Settings2 },
    ],
  },
  {
    label: "Voucher",
    requiresRouter: true,
    items: [
      { label: "Generate", href: "/vouchers/generate", icon: Zap },
      { label: "Voucher List", href: "/vouchers", icon: Receipt },
      { label: "Settings", href: "/vouchers/settings", icon: Ticket },
    ],
  },
  {
    label: "Reseller",
    requiresRouter: true,
    items: [
      { label: "Reseller List", href: "/resellers", icon: Store },
      { label: "Transactions", href: "/resellers/transactions", icon: History },
      { label: "Reseller Bot", href: "/resellers/bot", icon: BotMessageSquare },
      { label: "Bot Text Templates", href: "/resellers/bot-text", icon: MessageSquareText },
    ],
  },
  {
    label: "Network",
    items: [
      { label: "Routers", href: "/routers", icon: Router },
      { label: "Tunnel", href: "/tunnel", icon: Cable },
      { label: "Netwatch", href: "/netwatch", icon: Activity },
      { label: "Communication", href: "/communication", icon: MessageSquare },
      { label: "Logs", href: "/logs", icon: Terminal },
    ],
  },
  {
    label: "Reports",
    requiresRouter: true,
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Settings",
    adminOnly: true,
    items: [
      { label: "Dashboard Users", href: "/settings/users", icon: Users },
      { label: "App Settings", href: "/settings", icon: Settings },
      { label: "LLM Provider", href: "/settings/llm", icon: Bot },
      { label: "Admin VPN", href: "/settings/vpn", icon: Wifi },
      { label: "Billing & Plan", href: "/settings/billing", icon: CreditCard },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: UserCircle },
      { label: "Documentation", href: "/docs", icon: BookOpen },
    ],
  },
]
