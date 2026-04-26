"use client"

import {
  Users,
  User,
  Loader2,
  CheckSquare,
  Square,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type RecipientMode = "single" | "broadcast"

export interface Reseller {
  id: string
  name: string
  telegramId: string
  phone?: string
  status?: string
}

interface RecipientSelectorProps {
  mode: RecipientMode
  onModeChange: (mode: RecipientMode) => void
  resellerList: Reseller[]
  resellersLoading: boolean
  selectedResellerId: string
  onResellerChange: (id: string) => void
  customChatId: string
  onCustomChatIdChange: (value: string) => void
  selectedBroadcastIds: string[]
  onToggleBroadcastId: (id: string) => void
  onSelectAllBroadcast: () => void
}

export function RecipientSelector({
  mode,
  onModeChange,
  resellerList,
  resellersLoading,
  selectedResellerId,
  onResellerChange,
  customChatId,
  onCustomChatIdChange,
  selectedBroadcastIds,
  onToggleBroadcastId,
  onSelectAllBroadcast,
}: RecipientSelectorProps) {
  return (
    <>
      {/* Recipient mode toggle */}
      <div className="mb-6">
        <label className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3 block">
          Recipient Type
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onModeChange("single")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-headline font-bold transition-all duration-200 cursor-pointer ${
              mode === "single"
                ? "bg-[#06b6d4] text-[#00424f]"
                : "bg-surface-highest text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="h-4 w-4" />
            Single Recipient
          </button>
          <button
            onClick={() => onModeChange("broadcast")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-headline font-bold transition-all duration-200 cursor-pointer ${
              mode === "broadcast"
                ? "bg-[#06b6d4] text-[#00424f]"
                : "bg-surface-highest text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Broadcast All Resellers
          </button>
        </div>
      </div>

      {/* Recipient selector */}
      <div className="mb-6">
        <label className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3 block">
          {mode === "single" ? "Select Recipient" : "Select Resellers"}
        </label>

        {mode === "single" ? (
          <div className="space-y-3">
            {/* Reseller dropdown */}
            <Select
              value={selectedResellerId}
              onValueChange={(value) => {
                onResellerChange(value === "__none__" ? "" : value)
                if (value && value !== "__none__") onCustomChatIdChange("")
              }}
            >
              <SelectTrigger className="w-full bg-surface-highest border-none rounded-lg py-3 px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#4cd7f6]/40 cursor-pointer h-auto">
                <SelectValue placeholder="-- Select a reseller --" />
              </SelectTrigger>
              <SelectContent className="bg-surface-highest border-white/10">
                <SelectItem value="__none__" className="text-slate-400">-- Select a reseller --</SelectItem>
                {resellersLoading && (
                  <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                )}
                {resellerList.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.telegramId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-muted/30" />
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                or
              </span>
              <div className="flex-1 h-px bg-muted/30" />
            </div>

            {/* Custom Chat ID */}
            <Input
              type="text"
              value={customChatId}
              onChange={(e) => {
                onCustomChatIdChange(e.target.value)
                if (e.target.value) onResellerChange("")
              }}
              placeholder="Enter custom Telegram Chat ID"
              className="w-full bg-surface-highest border-none rounded-lg py-3 px-4 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4cd7f6]/40"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select All toggle */}
            <button
              onClick={onSelectAllBroadcast}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-headline font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {selectedBroadcastIds.length === resellerList.length &&
              resellerList.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Select All ({resellerList.length})
            </button>

            {/* Reseller checklist */}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {resellersLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading resellers...</span>
                </div>
              ) : resellerList.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">
                  No resellers with Telegram ID found
                </p>
              ) : (
                resellerList.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onToggleBroadcastId(r.id)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-surface-highest/60 transition-colors text-left cursor-pointer"
                  >
                    {selectedBroadcastIds.includes(r.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground font-medium truncate block">
                        {r.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono-tech">
                        ID: {r.telegramId}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
