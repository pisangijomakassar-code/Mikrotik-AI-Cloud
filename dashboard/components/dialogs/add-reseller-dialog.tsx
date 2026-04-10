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
      },
      {
        onSuccess: () => {
          toast.success("Reseller created")
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
            <h3 className="text-2xl font-headline font-bold text-foreground">Add Reseller</h3>
            <p className="text-sm text-muted-foreground/70">Create a new reseller account.</p>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Name *</label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="Reseller name"
                {...register("name")}
              />
              {errors.name?.message && (
                <p className="text-xs text-red-400 ml-1">{errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Phone</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="08xxxxxxxxxx"
                  {...register("phone")}
                />
                {errors.phone?.message && (
                  <p className="text-xs text-red-400 ml-1">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Telegram ID</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="123456789"
                  {...register("telegramId")}
                />
                {errors.telegramId?.message && (
                  <p className="text-xs text-red-400 ml-1">{errors.telegramId.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Initial Balance (Rp)</label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="0"
                type="number"
                min="0"
                {...register("balance")}
              />
              {errors.balance?.message && (
                <p className="text-xs text-red-400 ml-1">{errors.balance.message}</p>
              )}
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
              disabled={createReseller.isPending}
              className="bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {createReseller.isPending ? "Creating..." : "Add Reseller"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
