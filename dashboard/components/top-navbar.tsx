"use client"

import { Search, ShieldCheck, Cpu, Bell, LogOut, User, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { signOut } from "next-auth/react"
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

  return (
    <header className="flex items-center justify-between px-8 ml-64 w-[calc(100%-16rem)] h-16 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 font-headline font-medium">
      <div className="flex items-center gap-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="bg-[#2d3449] border-none text-sm rounded-lg pl-10 pr-4 py-2 w-64 focus:ring-1 focus:ring-[#4cd7f6] transition-all text-[#dae2fd] placeholder:text-slate-500 outline-none"
            placeholder="Query network state..."
            type="text"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) {
                  router.push("/chat")
                  toast.info(`Redirecting to AI Chat with: "${val}"`)
                }
              }
            }}
          />
        </div>
        <div className="flex gap-4 border-l border-white/10 pl-6 h-6 items-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ae176] shadow-[0_0_8px_#4ae176]" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              API: <span className="text-white">Online</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4cd7f6] shadow-[0_0_8px_#4cd7f6]" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              LLM: <span className="text-white">Ready</span>
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/routers")}
          title="Security & Routers"
          className="p-2 text-slate-400 hover:text-cyan-300 transition-colors opacity-80 hover:opacity-100"
        >
          <ShieldCheck className="h-5 w-5" />
        </button>
        <button
          onClick={() => router.push("/settings")}
          title="System Settings"
          className="p-2 text-slate-400 hover:text-cyan-300 transition-colors opacity-80 hover:opacity-100"
        >
          <Cpu className="h-5 w-5" />
        </button>
        <button
          onClick={() => router.push("/logs")}
          title="Notifications & Logs"
          className="p-2 relative text-slate-400 hover:text-cyan-300 transition-colors opacity-80 hover:opacity-100"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#ffb4ab] rounded-full border-2 border-slate-950" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-8 w-8 rounded-full overflow-hidden border border-[#4cd7f6]/20 hover:scale-105 transition-transform bg-[#222a3d] flex items-center justify-center"
            >
              <span className="text-xs font-bold text-[#4cd7f6]">A</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#131b2e] border-white/10 text-[#dae2fd]">
            <DropdownMenuLabel className="text-xs text-slate-400">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="text-xs gap-2 cursor-pointer focus:bg-[#222a3d] focus:text-[#4cd7f6]"
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="text-xs gap-2 cursor-pointer focus:bg-[#222a3d] focus:text-[#4cd7f6]"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs gap-2 cursor-pointer focus:bg-[#ffb4ab]/10 focus:text-[#ffb4ab]"
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
