"use client"

import { useEffect, useState } from "react"
import { Printer, X } from "lucide-react"
import QRCode from "qrcode"
import { useVoucherProfileSettings } from "@/hooks/use-voucher-profiles"

interface PrintVoucherSheetProps {
  vouchers: { username: string; password: string }[]
  profile: string
  /** Optional override: the captive-portal login URL (e.g. `http://10.5.50.1/login`).
   *  When set, the QR encodes an auto-login URL with credentials prefilled.
   *  When omitted, the QR encodes `username\npassword` as plain text. */
  hotspotLoginUrl?: string
  onClose: () => void
}

export function PrintVoucherSheet({ vouchers, profile, hotspotLoginUrl, onClose }: PrintVoucherSheetProps) {
  const { data: profileSettings } = useVoucherProfileSettings()
  const qrColor = profileSettings?.find((s) => s.profileName === profile)?.qrColor ?? "#000000"

  const [qrMap, setQrMap] = useState<Record<string, string>>({})

  // Generate QR codes for all vouchers once (by username+password key)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      for (const v of vouchers) {
        const key = `${v.username}|${v.password}`
        if (qrMap[key]) { next[key] = qrMap[key]; continue }
        const content = hotspotLoginUrl
          ? `${hotspotLoginUrl}?username=${encodeURIComponent(v.username)}&password=${encodeURIComponent(v.password)}`
          : `${v.username}\n${v.password}`
        try {
          next[key] = await QRCode.toDataURL(content, {
            margin: 0,
            width: 120,
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

  const now = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <>
      <style>{`
        @media print {
          * { visibility: hidden !important; }
          #print-voucher-root,
          #print-voucher-root * { visibility: visible !important; }
          #print-voucher-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0.5cm !important;
          }
          #print-voucher-controls { display: none !important; }
          .voucher-card { break-inside: avoid; }
          #voucher-grid {
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 4px !important;
            max-width: none !important;
          }
        }
      `}</style>

      <div id="print-voucher-root" className="fixed inset-0 z-[200] bg-white flex flex-col">
        {/* Controls bar — hidden when printing */}
        <div id="print-voucher-controls" className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
          <div>
            <p className="font-bold text-slate-800 text-sm">Cetak Voucher</p>
            <p className="text-xs text-slate-500">{vouchers.length} voucher · Profil: {profile}</p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Voucher grid */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          <div
            id="voucher-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "6px",
              maxWidth: "820px",
              margin: "0 auto",
            }}
          >
            {vouchers.map((v, i) => {
              const qrSrc = qrMap[`${v.username}|${v.password}`]
              return (
                <div
                  key={i}
                  className="voucher-card bg-white border border-slate-300 rounded p-2"
                  style={{ fontSize: "8pt", lineHeight: "1.35" }}
                >
                  <p style={{ fontSize: "6pt", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Voucher Hotspot
                  </p>
                  <p style={{ fontSize: "6pt", color: "#d1d5db", marginBottom: "3px" }}>{now}</p>
                  <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: "3px" }} />

                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "10pt", fontWeight: "800", color: "#111827", letterSpacing: "0.02em", wordBreak: "break-all" }}>
                        {v.username}
                      </p>
                      <p style={{ fontSize: "7pt", color: "#6b7280", wordBreak: "break-all" }}>
                        {v.password}
                      </p>
                    </div>
                    {qrSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrSrc}
                        alt="QR"
                        width={56}
                        height={56}
                        style={{ width: "56px", height: "56px", flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: "56px", height: "56px", background: "#f3f4f6", flexShrink: 0 }} />
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "3px", marginBottom: "2px" }} />
                  <p style={{ fontSize: "6pt", color: "#9ca3af" }}>{profile}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
