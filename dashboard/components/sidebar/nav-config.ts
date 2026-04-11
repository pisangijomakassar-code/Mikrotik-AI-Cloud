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
      { label: "Voucher History", href: "/resellers/vouchers", icon: Receipt },
      { label: "Reseller Bot", href: "/resellers/bot", icon: BotMessageSquare },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Routers", href: "/routers", icon: Router },
      { label: "Tunnel", href: "/tunnel", icon: Cable },
      { label: "Users", href: "/users", icon: Users, adminOnly: true },
      { label: "Logs", href: "/logs", icon: Terminal },
      { label: "Communication", href: "/communication", icon: MessageSquare },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: UserCircle },
      { label: "Plan", href: "/plan", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
      { label: "Docs", href: "/docs", icon: BookOpen },
    ],
  },
]
