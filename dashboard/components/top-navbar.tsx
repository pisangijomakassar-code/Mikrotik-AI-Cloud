"use client"

import { ShieldCheck, Cpu, Bell, LogOut, User, Settings, CreditCard, Menu } from "lucide-react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useSidebar } from "@/components/sidebar-context"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TopNavBar() {
  const router = useRouter()
  const { toggle } = useSidebar()

  return (
    <header className="flex items-center justify-between px-4 lg:px-8 lg:ml-64 w-full lg:w-[calc(100%-16rem)] h-16 sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border font-headline font-medium">
      <div className="flex items-center gap-6">
        <button
          onClick={toggle}
          className="p-2 text-muted-foreground hover:text-primary transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/routers")}
          title="Security & Routers"
          className="p-2 text-muted-foreground hover:text-primary transition-colors opacity-80 hover:opacity-100"
        >
          <ShieldCheck className="h-5 w-5" />
        </button>
        <button
          onClick={() => router.push("/settings")}
          title="System Settings"
          className="p-2 text-muted-foreground hover:text-primary transition-colors opacity-80 hover:opacity-100"
        >
          <Cpu className="h-5 w-5" />
        </button>
        <button
          onClick={() => router.push("/logs")}
          title="Notifications & Logs"
          className="p-2 relative text-muted-foreground hover:text-primary transition-colors opacity-80 hover:opacity-100"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#ffb4ab] rounded-full border-2 border-background" />
        </button>
        {/* ThemeToggle hidden — app uses dark mode only (hardcoded colors) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-8 w-8 rounded-full overflow-hidden border border-primary/20 hover:scale-105 transition-transform bg-muted flex items-center justify-center"
            >
              <span className="text-xs font-bold text-primary">A</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground">
            <DropdownMenuLabel className="text-xs text-muted-foreground">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => router.push("/profile")}
              className="text-xs gap-2 cursor-pointer focus:bg-muted focus:text-primary"
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/plan")}
              className="text-xs gap-2 cursor-pointer focus:bg-muted focus:text-primary"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Plan & Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs gap-2 cursor-pointer focus:bg-[#ffb4ab]/10 focus:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
