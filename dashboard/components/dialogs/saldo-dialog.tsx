"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatRupiah } from "@/lib/formatters"
import { Input } from "@/components/ui/input"
import { saldoSchema, type SaldoFormData } from "@/lib/schemas/reseller.schema"
import { useTopUpSaldo, useTopDownSaldo } from "@/hooks/use-resellers"

const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 200000]

interface SaldoDialogProps {
  type: "topup" | "topdown"
  resellerId: string
  resellerName: string
  currentBalance: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaldoDialog({
  type,
  resellerId,
  resellerName,
  currentBalance,
  open,
  onOpenChange,
}: SaldoDialogProps) {
  const topUpSaldo = useTopUpSaldo()
  const topDownSaldo = useTopDownSaldo()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SaldoFormData>({
    resolver: zodResolver(saldoSchema),
  })

  const watchedAmount = watch("amount")
  const parsedAmount = parseInt(watchedAmount) || 0
  const balanceAfter = type === "topup"
    ? currentBalance + parsedAmount
    : currentBalance - parsedAmount

  if (!open) return null

  function onSubmit(data: SaldoFormData) {
    const amount = parseInt(data.amount)
    const mutation = type === "topup" ? topUpSaldo : topDownSaldo
    mutation.mutate(
      {
        resellerId,
        data: {
          amount,
          description: data.description?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(type === "topup" ? "Top up successful" : "Top down successful")
          reset()
          onOpenChange(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">
              {type === "topup" ? "Top Up Saldo" : "Top Down Saldo"}
            </h3>
            <p className="text-sm text-muted-foreground/70">
              {resellerName} — Saldo saat ini: {formatRupiah(currentBalance)}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 md:p-8 space-y-5">
            {/* Preset amount buttons */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Nominal Cepat</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setValue("amount", String(amount), { shouldValidate: true })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-mono-tech font-bold border transition-all",
                      parsedAmount === amount
                        ? type === "topup"
                          ? "bg-[#4ae176]/20 border-[#4ae176]/50 text-tertiary"
                          : "bg-[#ffb4ab]/20 border-[#ffb4ab]/50 text-destructive"
                        : "bg-muted border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {formatRupiah(amount)}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Jumlah (Rp) *</label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="100000"
                type="number"
                min="1"
                {...register("amount")}
              />
              {errors.amount?.message && (
                <p className="text-xs text-destructive ml-1">{errors.amount.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Keterangan (opsional)</label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="e.g. Transfer BCA"
                {...register("description")}
              />
            </div>

            {/* Balance preview */}
            {parsedAmount > 0 && (
              <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo saat ini</span>
                  <span className="font-bold text-foreground">{formatRupiah(currentBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{type === "topup" ? "Ditambahkan" : "Dikurangi"}</span>
                  <span className={cn("font-bold", type === "topup" ? "text-tertiary" : "text-destructive")}>
                    {type === "topup" ? "+" : "-"}{formatRupiah(parsedAmount)}
                  </span>
                </div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo setelah</span>
                  <span className={cn("font-bold", balanceAfter >= 0 ? "text-tertiary" : "text-destructive")}>
                    {formatRupiah(balanceAfter)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={topUpSaldo.isPending || topDownSaldo.isPending}
              className={cn(
                "font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70",
                type === "topup"
                  ? "bg-linear-to-br from-tertiary to-tertiary-container text-primary-foreground"
                  : "bg-linear-to-br from-[#ffb4ab] to-[#ef4444] text-primary-foreground"
              )}
            >
              {(topUpSaldo.isPending || topDownSaldo.isPending)
                ? "Memproses..."
                : type === "topup"
                  ? "Top Up"
                  : "Top Down"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
