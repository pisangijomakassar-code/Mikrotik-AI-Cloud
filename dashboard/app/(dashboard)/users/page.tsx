"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { UserTable } from "@/components/user-table"
import { useAuth } from "@/hooks/use-auth"
import { useStats } from "@/hooks/use-stats"
import { AddUserDialog } from "@/components/add-user-dialog"
import { Users, Network, Coins, CheckCircle, Clock, CloudCheck } from "lucide-react"

export default function UsersPage() {
  const { isAdmin, isLoading } = useAuth()
  const { data: stats } = useStats()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push("/dashboard")
    }
  }, [isLoading, isAdmin, router])

  if (isLoading || !isAdmin) return null

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">User Management</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <CloudCheck className="h-[18px] w-[18px] text-[#4ae176] shrink-0" />
            Manage individual AI agent access and telegram bot configurations.
          </p>
        </div>
        <AddUserDialog />
      </div>

      {/* Dashboard Style Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 group hover:bg-[#222a3d] transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#4cd7f6]/10 rounded-lg text-[#4cd7f6]">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-xs text-slate-500">Total Users</span>
          </div>
          <div className="text-3xl font-headline font-bold text-[#dae2fd]">{stats?.totalUsers ?? 0}</div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-bold">
            {stats?.activeUsers ?? 0} active
          </div>
        </div>
        <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 group hover:bg-[#222a3d] transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#4ae176]/10 rounded-lg text-[#4ae176]">
              <Network className="h-5 w-5" />
            </div>
            <span className="text-xs text-slate-500">Active Routers</span>
          </div>
          <div className="text-3xl font-headline font-bold text-[#dae2fd]">{stats?.totalRouters ?? 0}</div>
          <div className="mt-2 text-[10px] text-[#4ae176] flex items-center gap-1 font-bold">
            <CheckCircle className="h-3.5 w-3.5" /> System healthy
          </div>
        </div>
        <div className="bg-[#131b2e] p-6 rounded-xl border border-white/5 group hover:bg-[#222a3d] transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#b9c7e0]/10 rounded-lg text-[#b9c7e0]">
              <Coins className="h-5 w-5" />
            </div>
            <span className="text-xs text-slate-500">API Calls</span>
          </div>
          <div className="text-3xl font-headline font-bold text-[#dae2fd]">{stats?.totalLogs ?? 0}</div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Last 24 hours
          </div>
        </div>
      </div>

      {/* User Table */}
      <UserTable />
    </div>
  )
}
