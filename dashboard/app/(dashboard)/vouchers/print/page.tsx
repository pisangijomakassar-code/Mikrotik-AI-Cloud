"use client"

import { useState, useMemo } from "react"
import { Printer, Loader2, Calendar, FileSearch } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useResellers } from "@/hooks/use-resellers"
import { useHotspotProfiles } from "@/hooks/use-hotspot"

type PrintMode = "latest" | "custom"
type PrintTemplate = "a4" | "thermal"

// Compute a sensible cols × rows grid for `perPage` voucher on A4 portrait.
// A4 ratio = 210/297 ≈ 0.707, so ideal cols ≈ sqrt(N * 0.707).
function computeGrid(perPage: number): { cols: number; rows: number; cardHeightMm: number } {
  const safe = Math.min(120, Math.max(4, perPage))
  const cols = Math.max(2, Math.min(12, Math.round(Math.sqrt(safe * 0.707))))
  const rows = Math.ceil(safe / cols)
  // A4 portrait usable height (297mm − 2×5mm margin) = 287mm.
  const cardHeightMm = 287 / rows
  return { cols, rows, cardHeightMm }
}

interface VoucherItem { username: string; password: string }
interface BatchData {
  id: string
  createdAt: string
  routerName: string
  profile: string
  count: number
  pricePerUnit: number
  hargaEndUser: number
  markUp: number
  discount: number
  reseller: { id: string; name: string } | null
  vouchers: VoucherItem[]
}
interface RouterMeta {
  name: string
  hotspotName: string
  hotspotLogoUrl: string
  dnsHotspot: string
}
interface PrintData {
  mode: PrintMode
  batches: BatchData[]
  router: RouterMeta
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID")
}

// Format RouterOS time string into friendly Indonesian.
// Examples: "1d" → "1 Hari", "12h" → "12 Jam", "30m" → "30 Menit",
// "1d 12h" → "1 Hari 12 Jam". Falls back to raw input on unknown shapes.
function formatValidity(v: string | undefined): string {
  if (!v) return ""
  const unitMap: Record<string, string> = { d: "Hari", h: "Jam", m: "Menit", w: "Minggu", s: "Detik" }
  const matches = [...v.matchAll(/(\d+)([dhwms])/g)]
  if (matches.length === 0) return v
  return matches.map((m) => `${m[1]} ${unitMap[m[2]] ?? m[2]}`).join(" ")
}

// Resolve display price for a printed voucher.
// Priority:
//   1. profile.sellPrice (Mikhmon on-login header position 4) — true end-user price
//   2. batch.hargaEndUser (set by our generate flow when user types Harga End User)
//   3. batch.pricePerUnit — fallback (often the modal/cost; last resort to avoid blank)
function resolvePrice(
  b: { hargaEndUser: number; pricePerUnit: number },
  profileSellPrice: number,
): number {
  if (profileSellPrice > 0) return profileSellPrice
  if (b.hargaEndUser > 0) return b.hargaEndUser
  return b.pricePerUnit
}

export default function CetakVoucherPage() {
  const { data: resellers } = useResellers()
  const { data: profiles } = useHotspotProfiles()

  const today = new Date().toISOString().slice(0, 10)
  const [mode, setMode] = useState<PrintMode>("latest")
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [resellerId, setResellerId] = useState("")
  const [profile, setProfile] = useState("")
  const [template, setTemplate] = useState<PrintTemplate>("a4")
  const [perPage, setPerPage] = useState(80)
  const [showPrice, setShowPrice] = useState(true)

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PrintData | null>(null)

  // Flatten batches into a single list of vouchers paired with batch meta — easier to render.
  const flatVouchers = useMemo(() => {
    if (!data) return []
    return data.batches.flatMap((b) =>
      b.vouchers.map((v) => ({
        ...v,
        batch: b,
      }))
    )
  }, [data])

  // profile name → { validity, sellPrice }. Looked up when rendering each card.
  const profileMap = useMemo(() => {
    const m: Record<string, { validity: string; sellPrice: number }> = {}
    profiles?.forEach((p) => {
      if (!p.name) return
      m[p.name] = {
        validity: p.validity ?? "",
        sellPrice: p.sellPrice ?? 0,
      }
    })
    return m
  }, [profiles])

  const totalVouchers = flatVouchers.length

  async function handleFetch() {
    setLoading(true)
    setData(null)
    try {
      const params = new URLSearchParams({ mode })
      if (mode === "custom") {
        if (from) params.set("from", from)
        if (to) params.set("to", to)
      }
      if (resellerId && resellerId !== "__all__") params.set("resellerId", resellerId)
      if (profile && profile !== "__all__") params.set("profile", profile)

      const res = await fetch(`/api/vouchers/print?${params}`)
      if (!res.ok) throw new Error("Gagal ambil data voucher")
      const json: PrintData = await res.json()
      setData(json)
      const total = json.batches.reduce((s, b) => s + b.vouchers.length, 0)
      if (total === 0) toast.warning("Tidak ada voucher untuk filter ini")
      else toast.success(`${total} voucher siap cetak`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal ambil data")
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    if (totalVouchers === 0) return
    window.print()
  }

  const lbl = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
  const inp = "w-full bg-muted border-none rounded-lg py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary outline-none"

  return (
    <div>
      {/* Header — hide on print */}
      <div className="mb-6 print:hidden">
        <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-1">Cetak Voucher</h2>
        <p className="text-muted-foreground flex items-center gap-2">
          <Printer className="h-[18px] w-[18px] text-primary shrink-0" />
          Cetak voucher hotspot dari batch yang sudah di-generate.
        </p>
      </div>

      {/* Form filter — hide on print */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <div className="lg:col-span-1 bg-surface-low rounded-3xl border border-border/20 p-6 space-y-5">
          <h3 className="text-sm font-headline font-bold text-foreground uppercase tracking-widest">Filter</h3>

          {/* Mode pilih voucher */}
          <div className="space-y-1.5">
            <label className={lbl}>Pilih Voucher</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("latest")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === "latest"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Terbaru
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Custom
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {mode === "latest"
                ? "Ambil batch voucher paling baru."
                : "Filter berdasarkan rentang tanggal generate."}
            </p>
          </div>

          {/* Date range — only when custom */}
          {mode === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={lbl}>Dari</label>
                <Input className={inp + " font-mono-tech"} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={lbl}>Sampai</label>
                <Input className={inp + " font-mono-tech"} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}

          {/* Reseller */}
          <div className="space-y-1.5">
            <label className={lbl}>Reseller</label>
            <Select value={resellerId || "__all__"} onValueChange={(v) => setResellerId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                <SelectValue placeholder="Semua reseller" />
              </SelectTrigger>
              <SelectContent className="bg-muted border-border text-foreground">
                <SelectItem value="__all__">Semua</SelectItem>
                <SelectItem value="__none__">Admin / Tanpa Reseller</SelectItem>
                {resellers?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profile / Jenis voucher */}
          <div className="space-y-1.5">
            <label className={lbl}>Profil Hotspot / Jenis Voucher</label>
            <Select value={profile || "__all__"} onValueChange={(v) => setProfile(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                <SelectValue placeholder="Semua profile" />
              </SelectTrigger>
              <SelectContent className="bg-muted border-border text-foreground">
                <SelectItem value="__all__">Semua</SelectItem>
                {profiles?.map((p) => (
                  <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipe cetak */}
          <div className="space-y-1.5">
            <label className={lbl}>Tipe Cetak</label>
            <Select value={template} onValueChange={(v) => setTemplate(v as PrintTemplate)}>
              <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-muted border-border text-foreground">
                <SelectItem value="a4">Kartu A4 (custom jumlah/halaman)</SelectItem>
                <SelectItem value="thermal">Thermal (58mm strip)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/60">
              {template === "a4" && "Pilih jumlah voucher per halaman A4 di bawah. Layout grid otomatis."}
              {template === "thermal" && "1 voucher per strip — printer thermal Bluetooth (58mm)."}
            </p>
          </div>

          {/* Voucher per halaman — hanya untuk A4 */}
          {template === "a4" && (
            <div className="space-y-1.5">
              <label className={lbl}>Voucher per Halaman (10–100)</label>
              <div className="flex items-center gap-2">
                <Input
                  className={inp + " font-mono-tech"}
                  type="number"
                  min={10}
                  max={100}
                  value={perPage}
                  onChange={(e) => setPerPage(Math.max(10, Math.min(100, Number(e.target.value) || 80)))}
                />
                <div className="flex gap-1">
                  {[20, 40, 80, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPerPage(n)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                        perPage === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                const g = computeGrid(perPage)
                return (
                  <p className="text-[10px] text-muted-foreground/60">
                    Grid otomatis: <strong>{g.cols} kolom × {g.rows} baris</strong> · tinggi kartu ≈ {g.cardHeightMm.toFixed(1)}mm
                  </p>
                )
              })()}
            </div>
          )}

          {/* Show price toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-primary"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
            />
            <span className="text-xs text-foreground">Tampilkan harga</span>
          </label>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleFetch}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-headline font-bold bg-muted text-foreground hover:bg-muted/80 transition-all disabled:opacity-60"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memuat...</> : <><FileSearch className="h-4 w-4" /> Tampilkan Preview</>}
            </button>
            <button
              onClick={handlePrint}
              disabled={!data || totalVouchers === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-headline font-bold bg-linear-to-br from-primary to-primary-container text-primary-foreground hover:brightness-105 transition-all disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Cetak ({totalVouchers})
            </button>
          </div>
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-2">
          {!data ? (
            <div className="bg-surface-low rounded-3xl border border-border/20 p-12 flex flex-col items-center justify-center gap-3 text-center min-h-[300px]">
              <Calendar className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Atur filter di kiri lalu klik <strong>Tampilkan Preview</strong></p>
            </div>
          ) : totalVouchers === 0 ? (
            <div className="bg-surface-low rounded-3xl border border-border/20 p-12 flex flex-col items-center justify-center gap-3 text-center min-h-[300px]">
              <FileSearch className="h-12 w-12 text-amber-500/40" />
              <p className="text-sm text-amber-500">Tidak ada voucher untuk filter ini</p>
            </div>
          ) : (
            <div className="bg-surface-low rounded-3xl border border-border/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-headline font-bold text-foreground">Preview</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalVouchers} voucher dari {data.batches.length} batch · template <strong>{template}</strong>
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 max-h-[500px] overflow-auto">
                <PreviewSheet
                  data={data}
                  template={template}
                  perPage={perPage}
                  showPrice={showPrice}
                  flatVouchers={flatVouchers}
                  profileMap={profileMap}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print-only sheet — full page when printing */}
      {data && totalVouchers > 0 && (
        <div className="hidden print:block">
          <PreviewSheet
            data={data}
            template={template}
            perPage={perPage}
            showPrice={showPrice}
            flatVouchers={flatVouchers}
            profileMap={profileMap}
          />
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            size: ${template === "thermal" ? "58mm auto" : "A4"};
            margin: ${template === "thermal" ? "2mm" : "5mm"};
          }
          body { margin: 0; background: white !important; }
          /* Hide app shell when printing */
          aside, header, [role="region"] { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}

interface PreviewProps {
  data: PrintData
  template: PrintTemplate
  perPage: number
  showPrice: boolean
  flatVouchers: Array<VoucherItem & { batch: BatchData }>
  profileMap: Record<string, { validity: string; sellPrice: number }>
}

function PreviewSheet({ data, template, perPage, showPrice, flatVouchers, profileMap }: PreviewProps) {
  const router = data.router
  const hotspotName = router.hotspotName || router.name || "Hotspot"

  const cardProps = (v: VoucherItem & { batch: BatchData }) => {
    const profileMeta = profileMap[v.batch.profile] ?? { validity: "", sellPrice: 0 }
    return {
      v,
      hotspotName,
      showPrice,
      validity: formatValidity(profileMeta.validity),
      price: resolvePrice(v.batch, profileMeta.sellPrice),
    }
  }

  if (template === "thermal") {
    return (
      <div className="thermal-sheet">
        {flatVouchers.map((v, i) => (
          <ThermalCard key={`${v.batch.id}-${i}`} {...cardProps(v)} />
        ))}
        <ThermalStyles />
      </div>
    )
  }

  // A4 mode — dynamic grid based on perPage.
  const { cols, cardHeightMm } = computeGrid(perPage)
  // Pick a card-density class so font sizes scale with cell size.
  const density = cardHeightMm < 24 ? "vc-tiny" : cardHeightMm < 32 ? "vc-small" : "vc-roomy"

  return (
    <div
      className={`card-grid card-grid-a4 ${density}`}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 0,
        background: "white",
        color: "#000",
      }}
    >
      {flatVouchers.map((v, i) => (
        <CardA4 key={`${v.batch.id}-${i}`} {...cardProps(v)} cardHeightMm={cardHeightMm} />
      ))}
      <CardGridStyles />
    </div>
  )
}

interface CardProps {
  v: VoucherItem & { batch: BatchData }
  hotspotName: string
  showPrice: boolean
  validity: string
  price: number
}

function CardA4({ v, hotspotName, showPrice, validity, price, cardHeightMm }: CardProps & { cardHeightMm: number }) {
  return (
    <div className="vc" style={{ minHeight: `${cardHeightMm}mm`, height: `${cardHeightMm}mm` }}>
      <div className="vc-name">{hotspotName}</div>
      <div className="vc-user">{v.username}</div>
      {validity && <div className="vc-validity">{validity}</div>}
      {showPrice && price > 0 && <div className="vc-price">{formatRupiah(price)}</div>}
      {v.batch.reseller && <div className="vc-reseller">{v.batch.reseller.name}</div>}
    </div>
  )
}

function ThermalCard({ v, hotspotName, showPrice, validity, price }: CardProps) {
  return (
    <div className="thermal-card">
      <div className="t-name">{hotspotName}</div>
      <div className="t-user">{v.username}</div>
      {validity && <div className="t-validity">{validity}</div>}
      {showPrice && price > 0 && <div className="t-price">{formatRupiah(price)}</div>}
      {v.batch.reseller && <div className="t-reseller">— {v.batch.reseller.name} —</div>}
      <div className="t-sep">- - - - - - - - - - - - - - - - - - - - - - - -</div>
    </div>
  )
}

function CardGridStyles() {
  return (
    <style jsx global>{`
      .vc {
        border: 0.3mm solid #444;
        padding: 1mm 1.2mm;
        text-align: center;
        font-family: ui-sans-serif, system-ui, sans-serif;
        line-height: 1.1;
        page-break-inside: avoid;
        box-sizing: border-box;
        overflow: hidden;
        color: #000;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      /* Density tiers — font sizes scale with available card height. */
      .vc-roomy .vc-name     { font-size: 9pt; font-weight: 600; color: #555; margin-bottom: 1mm; }
      .vc-roomy .vc-user     { font-family: ui-monospace, "JetBrains Mono", Consolas, monospace; font-size: 16pt; font-weight: 800; letter-spacing: 0.05em; margin: 0.5mm 0; color: #000; }
      .vc-roomy .vc-validity { font-size: 9pt; font-weight: 600; color: #333; margin-top: 0.8mm; }
      .vc-roomy .vc-price    { font-size: 10pt; font-weight: 700; color: #000; margin-top: 0.5mm; }
      .vc-roomy .vc-reseller { font-size: 7pt; color: #777; font-style: italic; margin-top: 1mm; }

      .vc-small .vc-name     { font-size: 7pt; font-weight: 600; color: #555; margin-bottom: 0.8mm; }
      .vc-small .vc-user     { font-family: ui-monospace, "JetBrains Mono", Consolas, monospace; font-size: 12pt; font-weight: 800; letter-spacing: 0.05em; margin: 0.5mm 0; color: #000; }
      .vc-small .vc-validity { font-size: 7pt; font-weight: 600; color: #333; margin-top: 0.5mm; }
      .vc-small .vc-price    { font-size: 8pt; font-weight: 700; color: #000; margin-top: 0.5mm; }
      .vc-small .vc-reseller { font-size: 5.5pt; color: #777; font-style: italic; margin-top: 0.8mm; }

      .vc-tiny  .vc { padding: 0.5mm 0.8mm; }
      .vc-tiny  .vc-name     { font-size: 5.5pt; font-weight: 600; color: #555; margin-bottom: 0.3mm; }
      .vc-tiny  .vc-user     { font-family: ui-monospace, "JetBrains Mono", Consolas, monospace; font-size: 9pt; font-weight: 800; letter-spacing: 0.04em; margin: 0.2mm 0; color: #000; }
      .vc-tiny  .vc-validity { font-size: 5.5pt; font-weight: 600; color: #333; margin-top: 0.2mm; }
      .vc-tiny  .vc-price    { font-size: 6.5pt; font-weight: 700; color: #000; margin-top: 0.2mm; }
      .vc-tiny  .vc-reseller { font-size: 4.5pt; color: #777; font-style: italic; margin-top: 0.3mm; }
    `}</style>
  )
}

function ThermalStyles() {
  return (
    <style jsx global>{`
      .thermal-sheet {
        width: 54mm;
        background: white;
        color: #000;
        font-family: ui-monospace, "JetBrains Mono", Consolas, monospace;
      }
      .thermal-card {
        text-align: center;
        padding: 2mm 0;
        page-break-inside: avoid;
        color: #000;
      }
      .t-name     { font-size: 9pt; font-weight: 700; margin-bottom: 1mm; }
      .t-user     { font-size: 16pt; font-weight: 900; letter-spacing: 0.1em; margin: 1mm 0; }
      .t-validity { font-size: 9pt; font-weight: 600; color: #222; margin-top: 1mm; }
      .t-price    { font-size: 10pt; font-weight: 700; margin-top: 1mm; }
      .t-reseller { font-size: 8pt; color: #666; margin-top: 1mm; }
      .t-sep      { font-size: 7pt; color: #999; letter-spacing: 0.05em; margin-top: 2mm; }
    `}</style>
  )
}
