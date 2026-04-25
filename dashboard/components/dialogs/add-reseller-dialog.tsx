"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { toast } from "sonner"
import { addResellerSchema, type AddResellerFormData } from "@/lib/schemas"
import { useCreateReseller } from "@/hooks/use-resellers"
import { Input } from "@/components/ui/input"

interface AddResellerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddResellerDialog({ open, onOpenChange }: AddResellerDialogProps) {
  const createReseller = useCreateReseller()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddResellerFormData>({
    resolver: zodResolver(addResellerSchema),
    defaultValues: {
      name: "",
      phone: "",
      telegramId: "",
      balance: "",
      discount: "0",
      voucherGroup: "default",
      uplink: "",
    },
  })

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  if (!open) return null

  function onSubmit(data: AddResellerFormData) {
    createReseller.mutate(
      {
        name: data.name,
        phone: data.phone || undefined,
        telegramId: data.telegramId || undefined,
        balance: data.balance ? parseInt(data.balance) : undefined,
        discount: data.discount ? parseInt(data.discount) : 0,
        voucherGroup: data.voucherGroup || "default",
        uplink: data.uplink || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Reseller berhasil ditambahkan")
          reset()
          onOpenChange(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">Add Reseller</h3>
            <p className="text-sm text-muted-foreground/70">Buat akun reseller baru.</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1">
          <div className="p-4 md:p-8 space-y-5">

            {/* Username / Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Username / Nama *</label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="e.g. tekinamaku"
                {...register("name")}
              />
              {errors.name?.message && <p className="text-xs text-red-400 ml-1">{errors.name.message}</p>}
            </div>

            {/* Telegram ID + No HP/WA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">ID Telegram User</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="421687437"
                  {...register("telegramId")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">No Hp/Whatsapp</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="08xxxxxxxxxx"
                  {...register("phone")}
                />
              </div>
            </div>

            {/* Saldo Awal */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Saldo Awal (Rp)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono-tech">Rp.</span>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 pl-10 pr-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="0"
                  type="number"
                  min="0"
                  {...register("balance")}
                />
              </div>
            </div>

            {/* Diskon + Grup Voucher */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Diskon (%)</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="0"
                  type="number"
                  min="0"
                  max="100"
                  {...register("discount")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Grup Voucher</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="default"
                  {...register("voucherGroup")}
                />
              </div>
            </div>

            {/* Uplink */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                Uplink <span className="text-muted-foreground/40 normal-case">(ID Telegram upline, opsional)</span>
              </label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="ID Telegram upline"
                {...register("uplink")}
              />
            </div>
          </div>

          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4 border-t border-border shrink-0">
            <button type="button" onClick={() => onOpenChange(false)} className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={createReseller.isPending}
              className="bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {createReseller.isPending ? "Menyimpan..." : "Tambah Reseller"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
