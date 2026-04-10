"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatRupiah } from "@/lib/formatters"
import { generateVoucherSchema, type GenerateVoucherFormData } from "@/lib/schemas/voucher.schema"
import { useGenerateVouchers } from "@/hooks/use-resellers"
import { useHotspotProfiles } from "@/hooks/use-hotspot"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface GenerateVoucherDialogProps {
  resellerId: string
  resellerName: string
  currentBalance: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateVoucherDialog({
  resellerId,
  resellerName,
  currentBalance,
  open,
  onOpenChange,
}: GenerateVoucherDialogProps) {
  const generateVouchers = useGenerateVouchers()
  const { data: profiles } = useHotspotProfiles()

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
      routerName: "",
      count: "",
      pricePerUnit: "",
    },
  })

  const watchedCount = watch("count")
  const watchedPrice = watch("pricePerUnit")
  const watchedProfile = watch("profile")

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
          pricePerUnit: parseInt(data.pricePerUnit),
          routerName: data.routerName?.trim() || "default",
        },
      },
      {
        onSuccess: () => {
          toast.success("Vouchers generated successfully")
          reset()
          onOpenChange(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">Generate Vouchers</h3>
            <p className="text-sm text-muted-foreground/70">Create hotspot vouchers for {resellerName}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 md:p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Profile *</label>
              <Select
                value={watchedProfile || "__default__"}
                onValueChange={(v) => setValue("profile", v === "__default__" ? "" : v, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full bg-muted border-none text-foreground text-sm">
                  <SelectValue placeholder="Select profile..." />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  <SelectItem value="__default__">Select profile...</SelectItem>
                  {profiles?.map((p: { name: string }) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.profile && <p className="text-xs text-[#ffb4ab] ml-1">{errors.profile.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Router Name (optional, default: default)</label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="default"
                {...register("routerName")}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Count *</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="10"
                  type="number"
                  min="1"
                  {...register("count")}
                />
                {errors.count && <p className="text-xs text-[#ffb4ab] ml-1">{errors.count.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Price per Unit (Rp) *</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="5000"
                  type="number"
                  min="1"
                  {...register("pricePerUnit")}
                />
                {errors.pricePerUnit && <p className="text-xs text-[#ffb4ab] ml-1">{errors.pricePerUnit.message}</p>}
              </div>
            </div>

            {/* Cost Calculation */}
            <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-bold text-foreground">
                  {watchedCount && watchedPrice ? `${watchedCount} x ${formatRupiah(parseInt(watchedPrice) || 0)} = ${formatRupiah(totalCost)}` : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Saldo</span>
                <span className="font-bold text-primary">{formatRupiah(currentBalance)}</span>
              </div>
              <div className="border-t border-border my-1" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining After</span>
                <span className={cn(
                  "font-bold",
                  remainingBalance >= 0 ? "text-[#4ae176]" : "text-[#ffb4ab]"
                )}>
                  {formatRupiah(remainingBalance)}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generateVouchers.isPending || remainingBalance < 0}
              className="bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {generateVouchers.isPending ? "Generating..." : "Generate Vouchers"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
