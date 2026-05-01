"use client"

import { useEffect, useState, useMemo } from "react"
import { Zap, Copy, Check, Loader2, Printer, Info } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PrintVoucherSheet } from "@/components/print-voucher-sheet"
import { useVoucherTypes } from "@/hooks/use-voucher-types"
import { useResellers } from "@/hooks/use-resellers"
import { useRouters } from "@/hooks/use-routers"
import { useHotspotProfiles } from "@/hooks/use-hotspot"
import { useActiveRouter } from "@/components/active-router-context"

const TYPE_CHAR_OPTIONS = [
  "Random abcd2345",
  "Random ABCD2345",
  "Random aBcD2345",
  "Random 5ab2c34d",
  "Random 5AB2C34D",
  "Random 5aB2c34D",
  "Random 1234",
]

const TYPE_LOGIN_OPTIONS = [
  "Username & Password",
  "Username = Password",
]

interface GeneratedVoucher { username: string; password: string }

export default function GenerateVoucherPage() {
  const { activeRouter } = useActiveRouter()
  const { data: voucherTypes, isLoading: loadingTypes } = useVoucherTypes()
  const { data: resellers, isLoading: loadingResellers } = useResellers(activeRouter || undefined)
  const { data: routers } = useRouters()
  const { data: hotspotProfiles, isLoading: loadingProfiles } = useHotspotProfiles(activeRouter || undefined)

  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [directProfile, setDirectProfile] = useState("")
  const [resellerId, setResellerId] = useState("")
  const [routerName, setRouterName] = useState(activeRouter || "")
  const [count, setCount] = useState(10)
  const [typeChar, setTypeChar] = useState("Random abcd2345")
  const [typeLogin, setTypeLogin] = useState("Username = Password")
  const [prefix, setPrefix] = useState("")
  const [charLen, setCharLen] = useState(6)
  const [diskonReseller, setDiskonReseller] = useState("")
  const [hargaEndUser, setHargaEndUser] = useState("")
  const [markUp, setMarkUp] = useState("")
  const [limitUptime, setLimitUptime] = useState("")
  const [limitQuota, setLimitQuota] = useState("")

  const [generating, setGenerating] = useState(false)
  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showPrint, setShowPrint] = useState(false)

  // Sync routerName with active router from top bar + reset reseller selection
  // (reseller di router lain tidak valid)
  useEffect(() => {
    if (activeRouter) setRouterName(activeRouter)
    setResellerId("")
  }, [activeRouter])

  const selectedReseller = resellers?.find((r) => r.id === resellerId)

  // Auto-fill diskon from selected reseller
  useMemo(() => {
    if (selectedReseller) {
      setDiskonReseller(String(selectedReseller.discount ?? 0))
    } else {
      setDiskonReseller("")
    }
  }, [selectedReseller])

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

  function handleSelectType(id: string) {
    setSelectedTypeId(id)
    const vt = voucherTypes?.find((v) => v.id === id)
    if (vt) {
      setTypeChar(vt.typeChar)
      setTypeLogin(vt.typeLogin)
      setPrefix(vt.prefix)
      setCharLen(vt.panjangKarakter)
      setLimitUptime(vt.limitUptime !== "0" ? vt.limitUptime : "")
      setHargaEndUser(String(vt.harga ?? ""))
    }
  }

  async function handleGenerate() {
    const profileToUse = selectedType?.profile ?? directProfile.trim()
    if (!profileToUse) {
      toast.error("Pilih Jenis Voucher atau Profil Hotspot")
      return
    }

    const qty = Math.max(1, Math.min(count, 200))
    setGenerating(true)
    try {
      const diskon = diskonReseller ? parseInt(diskonReseller) : 0
      const markup = diskon > 0 ? 0 : (markUp ? parseInt(markUp) : 0)

      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: profileToUse,
          count: qty,
          prefix,
          routerName: routerName || "",
          passwordLength: charLen,
          usernameLength: charLen,
          server: selectedType && selectedType.server !== "all" ? selectedType.server : "",
          typeChar,
          typeLogin,
          limitUptime: limitUptime || "",
          limitQuota: limitQuota ? parseInt(limitQuota) : undefined,
          resellerId: resellerId || null,
          pricePerUnit: hargaEndUser
            ? parseInt(hargaEndUser)
            : (selectedType?.harga ?? 0),
          discount: diskon,
          markUp: markup,
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
  const diskonFilled = diskonReseller !== "" && parseInt(diskonReseller) > 0

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

            {/* Jumlah Voucher */}
            <div className="space-y-1.5">
              <label className={lbl}>Jumlah Voucher (maks 200)</label>
              <Input className={inp + " font-mono-tech"} type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>

            {/* Reseller */}
            <div className="space-y-1.5">
              <label className={lbl}>Reseller (opsional)</label>
              <Select value={resellerId || "__none__"} onValueChange={(v) => { setResellerId(v === "__none__" ? "" : v); setSelectedTypeId("") }} disabled={loadingResellers}>
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue placeholder={loadingResellers ? "Memuat reseller..." : "Admin / Tanpa Reseller"} />
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

            {/* Diskon Reseller */}
            <div className="space-y-1.5">
              <label className={lbl}>Diskon Reseller (%)</label>
              <Input
                className={inp + " font-mono-tech"}
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={diskonReseller}
                onChange={(e) => setDiskonReseller(e.target.value)}
              />
              {diskonFilled && (
                <p className="text-[10px] text-amber-400 ml-1">Mark Up diabaikan karena Diskon diisi</p>
              )}
            </div>

            {/* Harga End User + Mark Up */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={lbl}>Harga End User (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono-tech">Rp</span>
                  <Input
                    className={inp + " font-mono-tech pl-8"}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={hargaEndUser}
                    onChange={(e) => setHargaEndUser(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={`${lbl} ${diskonFilled ? "opacity-30" : ""}`}>Mark Up (Rp)</label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono-tech ${diskonFilled ? "text-muted-foreground/30" : "text-muted-foreground"}`}>Rp</span>
                  <Input
                    className={inp + " font-mono-tech pl-8" + (diskonFilled ? " opacity-30 pointer-events-none" : "")}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={markUp}
                    disabled={diskonFilled}
                    onChange={(e) => setMarkUp(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Jenis Voucher (opsional — auto-fill defaults) */}
            <div className="space-y-1.5">
              <label className={lbl}>Jenis Voucher (opsional)</label>
              <Select value={selectedTypeId || "__none__"} onValueChange={(v) => handleSelectType(v === "__none__" ? "" : v)} disabled={loadingTypes}>
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue placeholder={loadingTypes ? "Memuat jenis voucher..." : "Pilih untuk auto-fill, atau skip"} />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value="__none__">— Tidak pakai (isi Profil Hotspot manual) —</SelectItem>
                  {filteredTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.namaVoucher} — {vt.profile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType && (
                <div className="text-[10px] text-muted-foreground/70 mt-1 space-y-0.5">
                  <div>Profile: <span className="text-primary font-mono-tech">{selectedType.profile}</span></div>
                  {selectedType.limitUptime !== "0" && <div>Limit Uptime: <span className="font-mono-tech text-foreground">{selectedType.limitUptime}</span></div>}
                </div>
              )}
            </div>

            {/* Profil Hotspot — dipakai kalau Jenis Voucher tidak dipilih */}
            {!selectedTypeId && (
              <div className="space-y-1.5">
                <label className={lbl}>Profil Hotspot *</label>
                <Select value={directProfile || "__none__"} onValueChange={(v) => setDirectProfile(v === "__none__" ? "" : v)} disabled={loadingProfiles}>
                  <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                    <SelectValue placeholder={loadingProfiles ? "Memuat profil..." : "Pilih profil hotspot di MikroTik"} />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="__none__" disabled>Pilih profil...</SelectItem>
                    {hotspotProfiles?.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name} {p.rateLimit ? <span className="text-muted-foreground text-xs">({p.rateLimit})</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            {/* Limit Uptime + Limit Quota */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={lbl}>Limit Uptime</label>
                <Input
                  className={inp + " font-mono-tech"}
                  placeholder="e.g. 1d / 2h"
                  value={limitUptime}
                  onChange={(e) => setLimitUptime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Limit Quota (Mb)</label>
                <Input
                  className={inp + " font-mono-tech"}
                  type="number"
                  min={0}
                  placeholder="0"
                  value={limitQuota}
                  onChange={(e) => setLimitQuota(e.target.value)}
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || (!selectedTypeId && !directProfile)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-headline font-bold text-sm bg-linear-to-br from-primary to-primary-container text-primary-foreground hover:brightness-105 transition-all disabled:opacity-50"
            >
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Zap className="h-4 w-4" /> Generate {count} Voucher</>}
            </button>
          </div>
        </div>

        {/* Result / Petunjuk Panel */}
        <div className="lg:col-span-3">
          <div className="bg-surface-low rounded-3xl border border-border/20 overflow-hidden h-full flex flex-col">
            {vouchers.length > 0 ? (
              <>
                <div className="flex items-center justify-between p-5 border-b border-border/20">
                  <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">
                    Hasil Generate <span className="text-primary">({vouchers.length})</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button onClick={copyAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                      <Copy className="h-3.5 w-3.5" /> Copy Semua
                    </button>
                    <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                      <Printer className="h-3.5 w-3.5" /> Cetak
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
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
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 p-5 border-b border-border/20">
                  <Info className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">Petunjuk</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {[
                    {
                      title: "JUMLAH VOUCHER",
                      desc: "Tulis jumlah voucher yang akan di generate.",
                    },
                    {
                      title: "RESELLER",
                      desc: "Pilih reseller yang akan menjual voucher ini.",
                    },
                    {
                      title: "DISKON dan MARK UP",
                      desc: "Jika Diskon diisi maka nilai Mark Up diabaikan.",
                    },
                    {
                      title: "JENIS VOUCHER",
                      desc: "Pilih jenis voucher yang akan digunakan. Jika tidak ingin pakai jenis voucher yang tersedia, biarkan saja.",
                    },
                    {
                      title: "PREFIX",
                      desc: "Tulis prefix yang menjadi ciri khas voucher yang akan di-generate.",
                    },
                    {
                      title: "LAIN LAIN",
                      desc: "Semua data selanjutnya akan menyesuaikan jenis voucher yang dipilih. Jika ingin mencetak tanpa menggunakan jenis voucher yang ada, maka silahkan isi semuanya secara manual.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
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
