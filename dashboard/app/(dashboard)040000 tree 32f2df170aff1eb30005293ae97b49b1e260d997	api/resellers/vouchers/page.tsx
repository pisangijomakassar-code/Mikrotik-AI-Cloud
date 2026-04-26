"use client"

import { useState } from "react"
import { Receipt, ChevronLeft, ChevronRight, PlusCircle, Zap, Copy, Check, Loader2, X, Printer } from "lucide-react"
import { PrintVoucherSheet } from "@/components/print-voucher-sheet"
import { useQueryClient } from "@tanstack/react-query"
import { useAllVouchers } from "@/hooks/use-vouchers"
import { useResellers } from "@/hooks/use-resellers"
import { useHotspotProfiles } from "@/hooks/use-hotspot"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sourceBadge(source: string) {
  switch (source) {
    case "dashboard":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4cd7f6]/15 text-primary">Dashboard</span>
    case "nanobot":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#4ae176]/15 text-tertiary">Nanobot</span>
    case "reseller_bot":
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#a78bfa]/15 text-[#a78bfa]">Reseller Bot</span>
    default:
      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-700/50 text-slate-400">{source}</span>
  }
}

interface GeneratedVoucher { username: string; password: string }

function GenerateVoucherDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: profiles, isLoading: profilesLoading } = useHotspotProfiles()
  const [profile, setProfile] = useState("")
  const [count, setCount] = useState(1)
  const [prefix, setPrefix] = useState("")
  const [generating, setGenerating] = useState(false)
  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showPrint, setShowPrint] = useState(false)

  const handleGenerate = async () => {
    if (!profile) { toast.error("Pilih profile terlebih dahulu"); return }
    const qty = Math.max(1, Math.min(count, 50))
    setGenerating(true)
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, count: qty, prefix: prefix || "" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed")
      }
      const result = await res.json()
      const generated: GeneratedVoucher[] = (result.vouchers ?? []).map(
        (v: { username: string; password: string }) => ({ username: v.username, password: v.password })
      )
      setVouchers((prev) => [...generated, ...prev])
      toast.success(`${generated.length} voucher berhasil dibuat`)
      // Refresh the history table
      queryClient.invalidateQueries({ queryKey: ["vouchers"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat voucher")
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
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
      <div className="w-full max-w-lg mx-4 md:mx-0 bg-surface-low border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 md:p-6 border-b border-border/20 flex items-center justify-between">
          <h3 className="text-xl font-headline font-bold text-foreground">Generate Voucher</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Profile</label>
              <Select value={profile} onValueChange={setProfile} disabled={profilesLoading}>
                <SelectTrigger className="bg-surface-highest border-none text-foreground text-sm">
                  <SelectValue placeholder={profilesLoading ? "Loading..." : "Pilih profile"} />
                </SelectTrigger>
                <SelectContent className="bg-surface-highest border-white/10 text-foreground">
                  {profiles?.map((p) => (<SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Jumlah</label>
              <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="bg-surface-highest border-none text-foreground text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Prefix</label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="v" className="bg-surface-highest border-none text-foreground text-sm" />
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating || profilesLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold font-headline bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#00424f] disabled:opacity-50 transition-all">
            {generating ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Zap className="h-4 w-4 shrink-0" />}
            {generating ? "Generating..." : "Generate Voucher"}
          </button>
          {vouchers.length > 0 && (
            <button
              onClick={() => setShowPrint(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-white/10 text-foreground hover:bg-muted/50 transition-all"
            >
              <Printer className="h-4 w-4 shrink-0" />
              Cetak Voucher ({vouchers.length})
            </button>
          )}
          {vouchers.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
              {vouchers.map((v, i) => (
                <div key={`${v.username}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border border-border/20">
                  <span className="font-mono text-sm"><span className="text-primary">{v.username}</span><span className="text-slate-600 mx-2">/</span><span className="text-emerald-400">{v.password}</span></span>
                  <button onClick={() => handleCopy(i, v)} className="p-1 rounded hover:bg-muted/50 transition-colors">{copiedIdx === i ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-500" />}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {showPrint && (
      <PrintVoucherSheet
        vouchers={vouchers}
        profile={profile}
        onClose={() => setShowPrint(false)}
      />
    )}
    </>
  )
}

export default function VoucherHistoryPage() {
  const [sourceFilter, setSourceFilter] = useState("")
  const [resellerFilter, setResellerFilter] = useState("")
  const [page, setPage] = useState(1)
  const [showGenerate, setShowGenerate] = useState(false)
  const pageSize = 20

  const { data: resellers } = useResellers()
  const { data: vouchersData, isLoading } = useAllVouchers({
    source: sourceFilter || undefined,
    resellerId: resellerFilter || undefined,
    page,
    pageSize,
  })

  // Support both paginated { data, total, page, totalPages } and plain array responses
  const vouchers = Array.isArray(vouchersData) ? vouchersData : vouchersData?.data
  const totalPages = Array.isArray(vouchersData) ? 1 : (vouchersData?.totalPages ?? 1)
  const total = Array.isArray(vouchersData) ? vouchersData.length : (vouchersData?.total ?? 0)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">
            Voucher History
          </h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Receipt className="h-[18px] w-[18px] text-primary shrink-0" />
            All vouchers from dashboard, Nanobot, and reseller bot.
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all duration-200"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          Generate Voucher
        </button>
      </div>

      {showGenerate && <GenerateVoucherDialog onClose={() => setShowGenerate(false)} />}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={sourceFilter || "__all__"} onValueChange={(v) => { setSourceFilter(v === "__all__" ? "" : v); setPage(1) }}>
          <SelectTrigger className="bg-surface-low border border-border/20 text-foreground text-sm">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent className="bg-surface-low border-white/10 text-foreground">
            <SelectItem value="__all__">All Sources</SelectItem>
            <SelectItem value="dashboard">Dashboard</SelectItem>
            <SelectItem value="nanobot">Nanobot</SelectItem>
            <SelectItem value="reseller_bot">Reseller Bot</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resellerFilter || "__all__"} onValueChange={(v) => { setResellerFilter(v === "__all__" ? "" : v); setPage(1) }}>
          <SelectTrigger className="bg-surface-low border border-border/20 text-foreground text-sm">
            <SelectValue placeholder="All Resellers" />
          </SelectTrigger>
          <SelectContent className="bg-surface-low border-white/10 text-foreground">
            <SelectItem value="__all__">All Resellers</SelectItem>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {resellers?.map((r: any) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(sourceFilter || resellerFilter) && (
          <button
            onClick={() => { setSourceFilter(""); setResellerFilter(""); setPage(1) }}
            className="text-xs text-slate-500 hover:text-primary transition-colors px-3"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-lowest/80">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Reseller</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Router</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Profile</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Count</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Total Cost</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border/20">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !vouchers?.length ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-slate-400">
                    No voucher batches found
                  </td>
                </tr>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                vouchers.map((batch: any) => (
                  <tr key={batch.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-5 text-sm text-slate-400">{formatDate(batch.createdAt)}</td>
                    <td className="px-6 py-5 text-sm font-bold text-foreground">
                      {batch.reseller?.name || batch.resellerName || "Admin"}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-400">{batch.routerName || "-"}</td>
                    <td className="px-6 py-5 text-sm text-foreground">{batch.profile}</td>
                    <td className="px-6 py-5 text-sm text-foreground">{batch.count}</td>
                    <td className="px-6 py-5 text-sm font-bold text-primary">{formatRupiah(batch.totalCost ?? 0)}</td>
                    <td className="px-6 py-5">{sourceBadge(batch.source)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-surface-lowest/80 flex items-center justify-between border-t border-border/20">
          <span className="text-xs text-slate-500">
            {totalPages > 1
              ? `Page ${page} of ${totalPages} (${total} total)`
              : `Showing ${vouchers?.length ?? 0} voucher batches`}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="p-1 hover:bg-surface-highest rounded-lg disabled:opacity-30"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg",
                      page === pageNum
                        ? "bg-[#4cd7f6] text-primary-foreground"
                        : "text-slate-400 hover:bg-surface-highest"
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              className="p-1 hover:bg-surface-highest rounded-lg disabled:opacity-30"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
