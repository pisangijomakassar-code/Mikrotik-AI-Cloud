"use client"

import { CheckCircle, XCircle, Users, Send } from "lucide-react"
import { TableSkeleton } from "@/components/table-skeleton"
import type { AgentUser } from "@/hooks/use-settings"

interface AgentListProps {
  agents: AgentUser[]
  isLoading: boolean
  telegramAllowFromCount: number
}

export function AgentList({ agents, isLoading, telegramAllowFromCount }: AgentListProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#4cd7f6]/10 rounded-lg">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold font-headline text-foreground">Agents</h3>
        <span className="text-xs text-slate-500 ml-auto">{agents.length} users</span>
      </div>
      <div className="bg-surface-low rounded-xl border border-border/20 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Telegram ID</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bot Token</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {isLoading ? (
              <TableSkeleton rows={3} columns={4} />
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">No users configured</td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3 text-sm text-foreground font-medium">{agent.name}</td>
                  <td className="px-6 py-3 text-xs font-mono text-slate-400">{agent.telegramId}</td>
                  <td className="px-6 py-3">
                    {agent.botToken ? (
                      <span className="text-xs font-mono text-slate-500">{agent.botToken.slice(0, 8)}&bull;&bull;&bull;</span>
                    ) : (
                      <span className="text-xs text-destructive">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {agent.botToken ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-tertiary">
                        <CheckCircle className="h-3 w-3" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
                        <XCircle className="h-3 w-3" /> Incomplete
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <Send className="h-3.5 w-3.5" />
        Telegram allowFrom: {telegramAllowFromCount} user IDs provisioned
      </div>
    </section>
  )
}
