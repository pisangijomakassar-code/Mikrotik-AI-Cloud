"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatRupiah } from "@/lib/formatters"
import { generateVoucherSchema, type GenerateVoucherFormData, CHAR_TYPES, LOGIN_TYPES } from "@/lib/schemas/voucher.schema"
import { useGenerateVouchers } from "@/hooks/use-resellers"
import { useHotspotProfiles } from "@/hooks/use-hotspot"
import { useActiveRouter } from "@/components/active-router-context"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface GenerateVoucherDialogProps {
  resellerId: string
  resellerName: string
  currentBalance: number
  routerName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateVoucherDialog({
  resellerId,
  resellerName,
  currentBalance,
  routerName: routerNameProp,
  open,
  onOpenChange,
}: GenerateVoucherDialogProps) {
  const generateVouchers = useGenerateVouchers()
  const { activeRouter } = useActiveRouter()
  const routerName = routerNameProp ?? activeRouter ?? undefined
  const { data: profiles } = useHotspotProfiles(routerName)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<GenerateVoucherFormData>({
    resolver: zodResolver(generateVoucherSchema),
    defaultValues: {
      profile: "",
      routerName: routerName ?? "",
      count: "",
      pricePerUnit: "0",
      prefix: "",
      usernameLength: "6",
      passwordLength: "6",
      charType: "alphanumeric",
      loginType: "separate",
      limitUptime: "",
      limitBytesTotal: "",
    },
  })

  const watchedCount = watch("count")
  const watchedPrice = watch("pricePerUnit")
  const watchedProfile = watch("profile")
  const watchedCharType = watch("charType")
  const watchedLoginType = watch("loginType")

  const totalCost = (parseInt(watchedCount) || 0) * (parseInt(watchedPrice) || 0)
  const remainingBalance = currentBalance - totalCost

  if (!open) return null

  function onSubmit(data: GenerateVoucherFormData) {
    generateVouchers.mutate(
      {
        resellerId,
        data: {
          profile: data.profile,
          count: parseInt(data.count),
          pricePerUnit: parseInt(data.pricePerUnit) || 0,
          routerName: data.routerName?.trim() || "default",
          prefix: data.prefix?.trim() || undefined,
          usernameLength: data.usernameLength ? parseInt(data.usernameLength) : undefined,
          passwordLength: data.passwordLength ? parseInt(data.passwordLength) : undefined,
          charType: data.charType || undefined,
          loginType: data.loginType || undefined,
          limitUptime: data.limitUptime?.trim() || undefined,
          limitBytesTotal: data.limitBytesTotal?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Voucher berhasil digenerate")
          reset()
          onOpenChange(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const inputClass = "w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-2xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">Generate Voucher</h3>
            <p className="text-sm text-muted-foreground/70">Buat voucher hotspot untuk {resellerName}</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 md:p-8 space-y-5 overflow-y-auto flex-1">

            {/* Profile & Router */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Profile *</label>
                <Select
                  value={watchedProfile || "__default__"}
                  onValueChange={(v) => setValue("profile", v === "__default__" ? "" : v, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                    <SelectValue placeholder="Pilih profile..." />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="__default__">Pilih profile...</SelectItem>
                    {profiles?.map((p: { name: string }) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.profile && <p className="text-xs text-destructive ml-1">{errors.profile.message}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Router</label>
                <Input
                  className={cn(inputClass, routerName ? "opacity-60 cursor-not-allowed" : "")}
                  placeholder="default"
                  readOnly={!!routerName}
                  {...register("routerName")}
                />
              </div>
            </div>

            {/* Count & Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Jumlah Voucher *</label>
                <Input className={cn(inputClass, "font-mono-tech")} placeholder="10" type="number" min="1" {...register("count")} />
                {errors.count && <p className="text-xs text-destructive ml-1">{errors.count.message}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Harga per Voucher (Rp)</label>
                <Input className={cn(inputClass, "font-mono-tech")} placeholder="5000" type="number" min="0" {...register("pricePerUnit")} />
                {errors.pricePerUnit && <p className="text-xs text-destructive ml-1">{errors.pricePerUnit.message}</p>}
              </div>
            </div>

            {/* Username settings */}
            <div className="space-y-3 border-t border-border pt-4">
              <p className={labelClass}>Pengaturan Username & Password</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Prefix</label>
                  <Input className={cn(inputClass, "font-mono-tech")} placeholder="e.g. V" {...register("prefix")} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Panjang Username</label>
                  <Input className={cn(inputClass, "font-mono-tech")} placeholder="6" type="number" min="4" max="16" {...register("usernameLength")} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Panjang Password</label>
                  <Input className={cn(inputClass, "font-mono-tech")} placeholder="6" type="number" min="4" max="16" {...register("passwordLength")} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Tipe Karakter</label>
                  <Select value={watchedCharType || "alphanumeric"} onValueChange={(v) => setValue("charType", v)}>
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
                <div className="space-y-2">
                  <label className={labelClass}>Tipe Login</label>
                  <Select value={watchedLoginType || "separate"} onValueChange={(v) => setValue("loginType", v)}>
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
              </div>
            </div>

            {/* Limit settings */}
            <div className="space-y-3 border-t border-border pt-4">
              <p className={labelClass}>Limit (Opsional)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Limit Uptime</label>
                  <Input className={inputClass} placeholder="e.g. 1h, 1d, 30m" {...register("limitUptime")} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Limit Kuota Total</label>
                  <Input className={inputClass} placeholder="e.g. 1G, 500M" {...register("limitBytesTotal")} />
                </div>
              </div>
            </div>

            {/* Cost summary */}
            <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Biaya</span>
                <span className="font-bold text-foreground">
                  {watchedCount && watchedPrice
                    ? `${watchedCount} x ${formatRupiah(parseInt(watchedPrice) || 0)} = ${formatRupiah(totalCost)}`
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo Saat Ini</span>
                <span className="font-bold text-primary">{formatRupiah(currentBalance)}</span>
              </div>
              <div className="border-t border-border my-1" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo Setelah</span>
                <span className={cn("font-bold", remainingBalance >= 0 ? "text-tertiary" : "text-destructive")}>
                  {formatRupiah(remainingBalance)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4 shrink-0">
            <button type="button" onClick={() => onOpenChange(false)} className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={generateVouchers.isPending || remainingBalance < 0}
              className="bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {generateVouchers.isPending ? "Generating..." : "Generate Voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
