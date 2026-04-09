"use client"

import { Search, ShieldCheck, Cpu, Bell } from "lucide-react"
import { Input } from "@/components/ui/input"

export function TopNavBar() {
  return (
    <header className="flex items-center justify-between px-8 ml-64 w-[calc(100%-16rem)] h-16 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 font-headline font-medium">
      <div className="flex items-center gap-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="bg-[#2d3449] border-none text-sm rounded-lg pl-10 pr-4 py-2 w-64 focus:ring-1 focus:ring-[#4cd7f6] transition-all text-[#dae2fd] placeholder:text-slate-500 outline-none"
            placeholder="Query network state..."
            type="text"
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
        <button className="p-2 text-slate-400 hover:text-cyan-300 transition-colors opacity-80 hover:opacity-100">
          <ShieldCheck className="h-5 w-5" />
        </button>
        <button className="p-2 text-slate-400 hover:text-cyan-300 transition-colors opacity-80 hover:opacity-100">
          <Cpu className="h-5 w-5" />
        </button>
        <button className="p-2 relative text-slate-400 hover:text-cyan-300 transition-colors opacity-80 hover:opacity-100">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#ffb4ab] rounded-full border-2 border-slate-950" />
        </button>
        <div className="h-8 w-8 rounded-full overflow-hidden border border-[#4cd7f6]/20 cursor-pointer hover:scale-105 transition-transform bg-[#222a3d] flex items-center justify-center">
          <span className="text-xs font-bold text-[#4cd7f6]">A</span>
        </div>
      </div>
    </header>
  )
}
