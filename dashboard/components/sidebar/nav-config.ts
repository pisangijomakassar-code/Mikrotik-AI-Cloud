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
  Webhook,
  MessageSquareText,
  Printer,
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
}

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
    items: [
      { label: "Users", href: "/hotspot/users", icon: Wifi },
      { label: "Active Sessions", href: "/hotspot/active", icon: Signal },
      { label: "User Profiles", href: "/hotspot/profiles", icon: UserCog },
    ],
  },
  {
    label: "PPP",
    items: [
      { label: "PPP Users", href: "/ppp/secrets", icon: Network },
      { label: "Active Sessions", href: "/ppp/active", icon: Activity },
      { label: "PPP Profiles", href: "/ppp/profiles", icon: Settings2 },
    ],
  },
  {
    label: "Reseller",
    items: [
      { label: "Reseller List", href: "/resellers", icon: Store },
      { label: "History Transaksi", href: "/resellers/transactions", icon: History },
      { label: "Generate Voucher", href: "/vouchers", icon: Zap },
      { label: "Cetak Voucher", href: "/vouchers/print", icon: Printer },
      { label: "Setting Voucher (Bot)", href: "/settings/vouchers", icon: Ticket },
      { label: "Voucher History", href: "/resellers/vouchers", icon: Receipt },
      { label: "Reseller Bot", href: "/resellers/bot", icon: BotMessageSquare },
      { label: "Webhook Config", href: "/settings/webhook", icon: Webhook },
      { label: "Bot Text", href: "/settings/bot-text", icon: MessageSquareText },
      { label: "Laporan", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Routers", href: "/routers", icon: Router },
      { label: "Tunnel", href: "/tunnel", icon: Cable },
      { label: "Netwatch", href: "/netwatch", icon: Activity },
      { label: "Users", href: "/users", icon: Users, adminOnly: true },
      { label: "Log Aktivitas", href: "/logs", icon: Terminal },
      { label: "Hotspot Log", href: "/logs/hotspot", icon: Wifi },
      { label: "User Log", href: "/logs/user", icon: UserCog },
      { label: "Communication", href: "/communication", icon: MessageSquare },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: UserCircle },
      { label: "Plan", href: "/plan", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
      { label: "LLM Provider", href: "/settings/llm", icon: Bot, adminOnly: true },
      { label: "Dokumentasi", href: "/docs", icon: BookOpen },
    ],
  },
]
