"use client"

import { useState } from "react"
import { Ticket, Zap, Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useHotspotProfiles } from "@/hooks/use-hotspot"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface GeneratedVoucher {
  username: string
  password: string
}

const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
const rand = (len: number) =>
  Array.from({ length: len }, () => charset[Math.floor(Math.random() * charset.length)]).join("")

async function generateVoucher(profile: string, prefix: string): Promise<GeneratedVoucher> {
  const username = (prefix || "v") + rand(5)
  const password = rand(6)

  const res = await fetch("/api/hotspot/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: username, password, profile }),
  })
  if (!res.ok) throw new Error("Failed to create voucher")
  return { username, password }
}

export function DashboardVoucherGenerate() {
  const { data: profiles, isLoading: profilesLoading } = useHotspotProfiles()
  const [profile, setProfile] = useState("")
  const [count, setCount] = useState(1)
  const [prefix, setPrefix] = useState("")
  const [generating, setGenerating] = useState(false)
  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!profile) {
      toast.error("Please select a profile")
      return
    }
    const qty = Math.max(1, Math.min(count, 50))
    setGenerating(true)
    try {
      const results: GeneratedVoucher[] = []
      for (let i = 0; i < qty; i++) {
        const v = await generateVoucher(profile, prefix)
        results.push(v)
      }
      setVouchers((prev) => [...results, ...prev])
      toast.success(`Generated ${results.length} voucher${results.length > 1 ? "s" : ""}`)
    } catch {
      toast.error("Failed to generate vouchers")
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = (idx: number, v: GeneratedVoucher) => {
    navigator.clipboard.writeText(`${v.username} / ${v.password}`)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="h-5 w-5 shrink-0 text-primary" />
        <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">
          Quick Voucher
        </h3>
      </div>

      {/* Form */}
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="w-full sm:w-auto sm:min-w-[160px]">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
            Profile
          </label>
          <Select value={profile} onValueChange={setProfile} disabled={profilesLoading}>
            <SelectTrigger className="bg-surface-low border-white/10 text-slate-200 h-9">
              <SelectValue placeholder={profilesLoading ? "Loading..." : "Select profile"} />
            </SelectTrigger>
            <SelectContent>
              {profiles?.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-20">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
            Count
          </label>
          <Input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="bg-surface-low border-white/10 text-slate-200 h-9"
          />
        </div>

        <div className="w-full sm:w-32">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
            Prefix
          </label>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Prefix"
            className="bg-surface-low border-white/10 text-slate-200 h-9"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || profilesLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold font-headline transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#00424f] h-9 shrink-0"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 shrink-0" />
          )}
          {generating ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* Results */}
      {vouchers.length > 0 && (
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {vouchers.map((v, i) => (
            <div
              key={`${v.username}-${i}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-low border border-border/20"
            >
              <span className="font-mono text-sm text-slate-300">
                <span className="text-primary">{v.username}</span>
                <span className="text-slate-600 mx-2">/</span>
                <span className="text-emerald-400">{v.password}</span>
              </span>
              <button
                onClick={() => handleCopy(i, v)}
                className="p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                title="Copy credentials"
              >
                {copiedIdx === i ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-slate-500" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
