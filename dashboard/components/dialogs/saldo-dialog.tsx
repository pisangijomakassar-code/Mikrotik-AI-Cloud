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
    formState: { errors },
  } = useForm<SaldoFormData>({
    resolver: zodResolver(saldoSchema),
  })

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
      <div className="w-full max-w-md mx-4 md:mx-0 bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">
              {type === "topup" ? "Top Up Saldo" : "Top Down Saldo"}
            </h3>
            <p className="text-sm text-slate-500">
              {resellerName} — Current: {formatRupiah(currentBalance)}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-[#dae2fd] transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 md:p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Amount (Rp) *</label>
              <Input
                className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                placeholder="100000"
                type="number"
                min="1"
                {...register("amount")}
              />
              {errors.amount?.message && (
                <p className="text-xs text-[#ffb4ab] ml-1">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Description (optional)</label>
              <Input
                className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                placeholder="e.g. Transfer BCA"
                {...register("description")}
              />
            </div>
          </div>
          <div className="p-4 md:p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={topUpSaldo.isPending || topDownSaldo.isPending}
              className={cn(
                "font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70",
                type === "topup"
                  ? "bg-gradient-to-br from-[#4ae176] to-[#22c55e] text-[#003640]"
                  : "bg-gradient-to-br from-[#ffb4ab] to-[#ef4444] text-[#003640]"
              )}
            >
              {(topUpSaldo.isPending || topDownSaldo.isPending)
                ? "Processing..."
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
