"use client"

import { useEffect, useState } from "react"
import { Printer, X, LayoutGrid, QrCode, AlignJustify } from "lucide-react"
import QRCode from "qrcode"
import { useVoucherProfileSettings } from "@/hooks/use-voucher-profiles"

type PrintLayout = "default" | "qrcode" | "small"

interface PrintVoucherSheetProps {
  vouchers: { username: string; password: string }[]
  profile: string
  hotspotLoginUrl?: string
  onClose: () => void
}

function useQrMap(
  vouchers: { username: string; password: string }[],
  qrColor: string,
  hotspotLoginUrl?: string
) {
  const [qrMap, setQrMap] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      for (const v of vouchers) {
        const key = `${v.username}|${v.password}`
        const content = hotspotLoginUrl
          ? `${hotspotLoginUrl}?username=${encodeURIComponent(v.username)}&password=${encodeURIComponent(v.password)}`
          : `${v.username}\n${v.password}`
        try {
          next[key] = await QRCode.toDataURL(content, {
            margin: 0,
            width: 180,
            color: { dark: qrColor, light: "#ffffff" },
            errorCorrectionLevel: "M",
          })
        } catch {
          next[key] = ""
        }
      }
      if (!cancelled) setQrMap(next)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vouchers, qrColor, hotspotLoginUrl])
  return qrMap
}

function VoucherDefault({ v, qrSrc, profile, now }: { v: { username: string; password: string }; qrSrc: string; profile: string; now: string }) {
  return (
    <div className="voucher-card bg-white border border-slate-300 rounded p-2" style={{ fontSize: "8pt", lineHeight: "1.35" }}>
      <p style={{ fontSize: "6pt", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Voucher Hotspot</p>
      <p style={{ fontSize: "6pt", color: "#d1d5db", marginBottom: "3px" }}>{now}</p>
      <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: "3px" }} />
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "10pt", fontWeight: "800", color: "#111827", letterSpacing: "0.02em", wordBreak: "break-all" }}>{v.username}</p>
          <p style={{ fontSize: "7pt", color: "#6b7280", wordBreak: "break-all" }}>{v.password}</p>
        </div>
        {qrSrc
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={qrSrc} alt="QR" width={56} height={56} style={{ width: "56px", height: "56px", flexShrink: 0 }} />
          : <div style={{ width: "56px", height: "56px", background: "#f3f4f6", flexShrink: 0 }} />
        }
      </div>
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "3px", marginBottom: "2px" }} />
      <p style={{ fontSize: "6pt", color: "#9ca3af" }}>{profile}</p>
    </div>
  )
}

function VoucherQrCode({ v, qrSrc, profile, now }: { v: { username: string; password: string }; qrSrc: string; profile: string; now: string }) {
  return (
    <div className="voucher-card bg-white border border-slate-300 rounded p-2.5" style={{ fontSize: "8pt", lineHeight: "1.4", textAlign: "center" }}>
      <p style={{ fontSize: "6pt", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Voucher Hotspot</p>
      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
        {qrSrc
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={qrSrc} alt="QR" width={96} height={96} style={{ width: "96px", height: "96px" }} />
          : <div style={{ width: "96px", height: "96px", background: "#f3f4f6" }} />
        }
      </div>
      <div style={{ borderTop: "1px solid #e5e7eb", margin: "3px 0" }} />
      <p style={{ fontSize: "9pt", fontWeight: "800", color: "#111827", wordBreak: "break-all" }}>{v.username}</p>
      <p style={{ fontSize: "7pt", color: "#6b7280", wordBreak: "break-all" }}>{v.password}</p>
      <div style={{ borderTop: "1px solid #e5e7eb", margin: "3px 0" }} />
      <p style={{ fontSize: "6pt", color: "#9ca3af" }}>{profile} · {now}</p>
    </div>
  )
}

function VoucherSmall({ v, profile }: { v: { username: string; password: string }; profile: string }) {
  return (
    <div className="voucher-card bg-white border border-slate-200 rounded px-2 py-1" style={{ fontSize: "7pt", lineHeight: "1.3" }}>
      <p style={{ fontSize: "5pt", color: "#d1d5db", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1px" }}>{profile}</p>
      <p style={{ fontSize: "9pt", fontWeight: "800", color: "#111827", wordBreak: "break-all" }}>{v.username}</p>
      <p style={{ fontSize: "7pt", color: "#6b7280", wordBreak: "break-all", letterSpacing: "0.02em" }}>{v.password}</p>
    </div>
  )
}

const LAYOUT_CONFIG: Record<PrintLayout, { cols: string; printCols: string; label: string; icon: React.ReactNode }> = {
  default: { cols: "repeat(4, minmax(0, 1fr))", printCols: "repeat(4, 1fr)", label: "Default", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  qrcode: { cols: "repeat(3, minmax(0, 1fr))", printCols: "repeat(3, 1fr)", label: "QR Code", icon: <QrCode className="h-3.5 w-3.5" /> },
  small: { cols: "repeat(5, minmax(0, 1fr))", printCols: "repeat(5, 1fr)", label: "Small", icon: <AlignJustify className="h-3.5 w-3.5" /> },
}

export function PrintVoucherSheet({ vouchers, profile, hotspotLoginUrl, onClose }: PrintVoucherSheetProps) {
  const { data: profileSettings } = useVoucherProfileSettings()
  const qrColor = profileSettings?.find((s) => s.profileName === profile)?.qrColor ?? "#000000"
  const [layout, setLayout] = useState<PrintLayout>("default")
  const qrMap = useQrMap(vouchers, qrColor, hotspotLoginUrl)

  const now = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

  const { cols, printCols } = LAYOUT_CONFIG[layout]

  return (
    <>
      <style>{`
        @media print {
          * { visibility: hidden !important; }
          #print-voucher-root,
          #print-voucher-root * { visibility: visible !important; }
          #print-voucher-root {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            padding: 0.5cm !important;
          }
          #print-voucher-controls { display: none !important; }
          .voucher-card { break-inside: avoid; }
          #voucher-grid { grid-template-columns: ${printCols} !important; gap: 4px !important; max-width: none !important; }
        }
      `}</style>

      <div id="print-voucher-root" className="fixed inset-0 z-[200] bg-white flex flex-col">
        {/* Controls */}
        <div id="print-voucher-controls" className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
          <div>
            <p className="font-bold text-slate-800 text-sm">Cetak Voucher</p>
            <p className="text-xs text-slate-500">{vouchers.length} voucher · Profil: {profile}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Layout selector */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {(Object.entries(LAYOUT_CONFIG) as [PrintLayout, typeof LAYOUT_CONFIG[PrintLayout]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setLayout(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    layout === key
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <X className="h-4 w-4" />
              Tutup
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          <div
            id="voucher-grid"
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: "6px",
              maxWidth: layout === "small" ? "900px" : "820px",
              margin: "0 auto",
            }}
          >
            {vouchers.map((v, i) => {
              const qrSrc = qrMap[`${v.username}|${v.password}`] ?? ""
              if (layout === "qrcode") return <VoucherQrCode key={i} v={v} qrSrc={qrSrc} profile={profile} now={now} />
              if (layout === "small") return <VoucherSmall key={i} v={v} profile={profile} />
              return <VoucherDefault key={i} v={v} qrSrc={qrSrc} profile={profile} now={now} />
            })}
          </div>
        </div>
      </div>
    </>
  )
}
