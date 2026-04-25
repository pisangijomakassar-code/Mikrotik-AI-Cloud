"use client"

import { useState } from "react"
import { SlidersHorizontal, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useHotspotProfiles } from "@/hooks/use-hotspot"
import { useVoucherProfileSettings, useSaveVoucherProfileSetting } from "@/hooks/use-voucher-profiles"
import { CHAR_TYPES, LOGIN_TYPES } from "@/lib/schemas/voucher.schema"
import { formatRupiah } from "@/lib/formatters"

interface ProfileForm {
  price: string
  charType: string
  charLength: string
  loginType: string
  limitUptime: string
  limitQuota: string
  qrColor: string
}

const DEFAULT_FORM: ProfileForm = {
  price: "0",
  charType: "alphanumeric",
  charLength: "6",
  loginType: "separate",
  limitUptime: "",
  limitQuota: "",
  qrColor: "#000000",
}

export default function VoucherProfilesPage() {
  const { data: hotspotProfiles, isLoading: loadingProfiles } = useHotspotProfiles()
  const { data: savedSettings, isLoading: loadingSettings } = useVoucherProfileSettings()
  const saveSetting = useSaveVoucherProfileSetting()

  const [forms, setForms] = useState<Record<string, ProfileForm>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const isLoading = loadingProfiles || loadingSettings

  function getForm(profileName: string): ProfileForm {
    if (forms[profileName]) return forms[profileName]
    const saved = savedSettings?.find((s) => s.profileName === profileName)
    if (saved) {
      return {
        price: String(saved.price),
        charType: saved.charType,
        charLength: String(saved.charLength),
        loginType: saved.loginType,
        limitUptime: saved.limitUptime ?? "",
        limitQuota: saved.limitQuota ?? "",
        qrColor: saved.qrColor,
      }
    }
    return DEFAULT_FORM
  }

  function updateForm(profileName: string, field: keyof ProfileForm, value: string) {
    setForms((prev) => ({
      ...prev,
      [profileName]: { ...getForm(profileName), [field]: value },
    }))
  }

  async function handleSave(profileName: string) {
    const form = getForm(profileName)
    setSaving((prev) => ({ ...prev, [profileName]: true }))
    try {
      await saveSetting.mutateAsync({
        profileName,
        price: parseInt(form.price) || 0,
        charType: form.charType,
        charLength: parseInt(form.charLength) || 6,
        loginType: form.loginType,
        limitUptime: form.limitUptime.trim() || null,
        limitQuota: form.limitQuota.trim() || null,
        qrColor: form.qrColor,
      })
      toast.success(`Pengaturan profil "${profileName}" disimpan`)
    } catch {
      toast.error("Gagal menyimpan pengaturan")
    } finally {
      setSaving((prev) => ({ ...prev, [profileName]: false }))
    }
  }

  const inputClass = "w-full bg-muted border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-muted-foreground/50 text-foreground outline-none"
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-0.5"

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Pengaturan Voucher per Profil</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-[18px] w-[18px] text-primary shrink-0" />
            Konfigurasi harga, karakter, dan limit untuk setiap profil hotspot.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : !hotspotProfiles?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>Tidak ada profil hotspot ditemukan.</p>
          <p className="text-sm mt-1">Pastikan router sudah terhubung dan memiliki profil hotspot.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {hotspotProfiles.map((p: { name: string; rateLimit?: string }) => {
            const form = getForm(p.name)
            const isSaving = saving[p.name]
            return (
              <div key={p.name} className="bg-surface-low rounded-2xl border border-border/20 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-headline font-bold text-foreground">{p.name}</h3>
                    {p.rateLimit && <p className="text-xs text-slate-500 mt-0.5">{p.rateLimit}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Harga saat ini</p>
                    <p className="text-sm font-bold text-tertiary">{formatRupiah(parseInt(form.price) || 0)}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Price & QR Color */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Harga per Voucher (Rp)</label>
                      <Input
                        className={inputClass + " font-mono-tech"}
                        type="number"
                        min="0"
                        placeholder="5000"
                        value={form.price}
                        onChange={(e) => updateForm(p.name, "price", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Limit Uptime</label>
                      <Input
                        className={inputClass}
                        placeholder="e.g. 1h, 1d, 30m"
                        value={form.limitUptime}
                        onChange={(e) => updateForm(p.name, "limitUptime", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Limit Kuota Total</label>
                      <Input
                        className={inputClass}
                        placeholder="e.g. 1G, 500M"
                        value={form.limitQuota}
                        onChange={(e) => updateForm(p.name, "limitQuota", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Char settings */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Tipe Karakter</label>
                      <Select value={form.charType} onValueChange={(v) => updateForm(p.name, "charType", v)}>
                        <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-muted border-border text-foreground">
                          {CHAR_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Panjang Karakter</label>
                      <Input
                        className={inputClass + " font-mono-tech"}
                        type="number"
                        min="4"
                        max="16"
                        placeholder="6"
                        value={form.charLength}
                        onChange={(e) => updateForm(p.name, "charLength", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Tipe Login</label>
                      <Select value={form.loginType} onValueChange={(v) => updateForm(p.name, "loginType", v)}>
                        <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-muted border-border text-foreground">
                          {LOGIN_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Warna QR Code</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.qrColor}
                          onChange={(e) => updateForm(p.name, "qrColor", e.target.value)}
                          className="h-10 w-12 rounded-lg border-none bg-muted cursor-pointer p-1"
                        />
                        <Input
                          className={inputClass + " font-mono-tech"}
                          value={form.qrColor}
                          onChange={(e) => updateForm(p.name, "qrColor", e.target.value)}
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => handleSave(p.name)}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-6 py-2.5 rounded-lg hover:brightness-105 transition-all disabled:opacity-60"
                  >
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="h-4 w-4" /> Simpan</>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
