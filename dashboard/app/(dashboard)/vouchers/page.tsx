"use client"

import { useState, useMemo } from "react"
import { Zap, Copy, Check, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PrintVoucherSheet } from "@/components/print-voucher-sheet"
import { useVoucherTypes } from "@/hooks/use-voucher-types"
import { useResellers } from "@/hooks/use-resellers"
import { useRouters } from "@/hooks/use-routers"

const TYPE_CHAR_OPTIONS = [
  "Random abcd",
  "Random ABCD",
  "Random 1234",
  "Random abcd1234",
  "Random ABCD1234",
]

const TYPE_LOGIN_OPTIONS = [
  "Username & Password",
  "Username = Password",
]

interface GeneratedVoucher { username: string; password: string }

export default function GenerateVoucherPage() {
  const { data: voucherTypes } = useVoucherTypes()
  const { data: resellers } = useResellers()
  const { data: routers } = useRouters()

  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [resellerId, setResellerId] = useState("")
  const [routerName, setRouterName] = useState("")
  const [count, setCount] = useState(10)
  const [typeChar, setTypeChar] = useState("Random abcd")
  const [typeLogin, setTypeLogin] = useState("Username = Password")
  const [prefix, setPrefix] = useState("")
  const [charLen, setCharLen] = useState(6)

  const [generating, setGenerating] = useState(false)
  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showPrint, setShowPrint] = useState(false)

  // When reseller is selected, filter voucher types by voucherGroup
  const selectedReseller = resellers?.find((r) => r.id === resellerId)

  const filteredTypes = useMemo(() => {
    if (!voucherTypes) return []
    if (!selectedReseller?.voucherGroup || selectedReseller.voucherGroup === "default") return voucherTypes
    const resellerGroups = selectedReseller.voucherGroup.split(",").map((g) => g.trim())
    return voucherTypes.filter((vt) => {
      const vtGroups = vt.voucherGroup.split(",").map((g) => g.trim())
      return vtGroups.some((g) => resellerGroups.includes(g) || g === "default")
    })
  }, [voucherTypes, selectedReseller])

  const selectedType = voucherTypes?.find((v) => v.id === selectedTypeId)

  // When jenis voucher selected, auto-fill form fields
  function handleSelectType(id: string) {
    setSelectedTypeId(id)
    const vt = voucherTypes?.find((v) => v.id === id)
    if (vt) {
      setTypeChar(vt.typeChar)
      setTypeLogin(vt.typeLogin)
      setPrefix(vt.prefix)
      setCharLen(vt.panjangKarakter)
    }
  }

  async function handleGenerate() {
    if (!selectedTypeId) { toast.error("Pilih jenis voucher terlebih dahulu"); return }
    if (!selectedType) return

    const qty = Math.max(1, Math.min(count, 200))
    setGenerating(true)
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: selectedType.profile,
          count: qty,
          prefix,
          routerName: routerName || "",
          passwordLength: charLen,
          usernameLength: charLen,
          server: selectedType.server !== "all" ? selectedType.server : "",
          typeChar,
          typeLogin,
          limitUptime: selectedType.limitUptime !== "0" ? selectedType.limitUptime : "",
          resellerId: resellerId || null,
          pricePerUnit: selectedType.harga,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Gagal generate")
      }
      const result = await res.json()
      const generated: GeneratedVoucher[] = (result.vouchers ?? []).map(
        (v: { username: string; password: string }) => ({ username: v.username, password: v.password })
      )
      setVouchers(generated)
      toast.success(`${generated.length} voucher berhasil dibuat`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat voucher")
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy(idx: number, v: GeneratedVoucher) {
    navigator.clipboard.writeText(`${v.username} / ${v.password}`)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  function copyAll() {
    const text = vouchers.map((v) => `${v.username} / ${v.password}`).join("\n")
    navigator.clipboard.writeText(text)
    toast.success("Semua voucher disalin")
  }

  const lbl = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
  const inp = "w-full bg-muted border-none rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-1">Generate Voucher (Fisik)</h2>
        <p className="text-muted-foreground flex items-center gap-2">
          <Zap className="h-[18px] w-[18px] text-primary shrink-0" />
          Buat voucher hotspot langsung ke MikroTik dan cetak fisik.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-surface-low rounded-3xl border border-border/20 p-6 space-y-5">
            <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">Konfigurasi</h3>

            {/* Reseller */}
            <div className="space-y-1.5">
              <label className={lbl}>Reseller (opsional)</label>
              <Select value={resellerId || "__none__"} onValueChange={(v) => { setResellerId(v === "__none__" ? "" : v); setSelectedTypeId("") }}>
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue placeholder="Admin / Tanpa Reseller" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value="__none__">Admin / Tanpa Reseller</SelectItem>
                  {resellers?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} {r.voucherGroup !== "default" ? <span className="text-muted-foreground text-xs">(Grup: {r.voucherGroup})</span> : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jenis Voucher */}
            <div className="space-y-1.5">
              <label className={lbl}>Jenis Voucher *</label>
              <Select value={selectedTypeId || "__none__"} onValueChange={(v) => handleSelectType(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue placeholder="Pilih jenis voucher..." />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  {filteredTypes.length === 0 ? (
                    <SelectItem value="__none__" disabled>Tidak ada jenis voucher</SelectItem>
                  ) : (
                    filteredTypes.map((vt) => (
                      <SelectItem key={vt.id} value={vt.id}>
                        {vt.namaVoucher} — {vt.profile}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedType && (
                <div className="text-[10px] text-muted-foreground/70 mt-1 space-y-0.5">
                  <div>Profile: <span className="text-primary font-mono-tech">{selectedType.profile}</span></div>
                  {selectedType.limitUptime !== "0" && <div>Limit Uptime: <span className="font-mono-tech text-foreground">{selectedType.limitUptime}</span></div>}
                </div>
              )}
            </div>

            {/* Server / Router */}
            <div className="space-y-1.5">
              <label className={lbl}>Server / Router</label>
              <Select value={routerName || "__default__"} onValueChange={(v) => setRouterName(v === "__default__" ? "" : v)}>
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue placeholder="Router default" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value="__default__">Router default</SelectItem>
                  {routers?.map((r) => (
                    <SelectItem key={r.id} value={r.name}>{r.name} {r.label ? `(${r.label})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jumlah */}
            <div className="space-y-1.5">
              <label className={lbl}>Jumlah Voucher (maks 200)</label>
              <Input className={inp + " font-mono-tech"} type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>

            {/* Prefix + Panjang */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={lbl}>Prefix</label>
                <Input className={inp + " font-mono-tech"} placeholder="v" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Panjang Karakter</label>
                <Select value={String(charLen)} onValueChange={(v) => setCharLen(Number(v))}>
                  <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    {[3, 4, 5, 6, 7, 8].map((n) => <SelectItem key={n} value={String(n)}>{n} karakter</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tipe Karakter */}
            <div className="space-y-1.5">
              <label className={lbl}>Tipe Karakter</label>
              <Select value={typeChar} onValueChange={setTypeChar}>
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  {TYPE_CHAR_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tipe Login */}
            <div className="space-y-1.5">
              <label className={lbl}>Tipe Login</label>
              <Select value={typeLogin} onValueChange={setTypeLogin}>
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  {TYPE_LOGIN_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedTypeId}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-headline font-bold text-sm bg-linear-to-br from-primary to-primary-container text-primary-foreground hover:brightness-105 transition-all disabled:opacity-50"
            >
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Zap className="h-4 w-4" /> Generate {count} Voucher</>}
            </button>
          </div>
        </div>

        {/* Result Panel */}
        <div className="lg:col-span-3">
          <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border/20">
              <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">
                Hasil Generate {vouchers.length > 0 && <span className="text-primary">({vouchers.length})</span>}
              </h3>
              {vouchers.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                    <Copy className="h-3.5 w-3.5" /> Copy Semua
                  </button>
                  <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                    <Printer className="h-3.5 w-3.5" /> Cetak
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {vouchers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Zap className="h-12 w-12 text-slate-500/30" />
                  <p className="text-sm text-slate-500">Hasil voucher akan muncul di sini</p>
                  <p className="text-xs text-slate-600">Pilih jenis voucher dan klik Generate</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vouchers.map((v, i) => (
                    <div key={`${v.username}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted border border-border/20">
                      <div className="font-mono-tech text-sm">
                        <span className="text-primary">{v.username}</span>
                        {typeLogin !== "Username Only" && (
                          <><span className="text-slate-600 mx-1">/</span><span className="text-tertiary">{v.password}</span></>
                        )}
                      </div>
                      <button onClick={() => handleCopy(i, v)} className="p-1 rounded hover:bg-surface-low transition-colors shrink-0">
                        {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-tertiary" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPrint && vouchers.length > 0 && (
        <PrintVoucherSheet
          vouchers={vouchers}
          profile={selectedType?.profile ?? ""}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
