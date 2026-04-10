"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { editResellerSchema, type EditResellerFormData } from "@/lib/schemas/reseller.schema"
import { useUpdateReseller } from "@/hooks/use-resellers"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface EditResellerDialogProps {
  reseller: Record<string, unknown> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditResellerDialog({ reseller, open, onOpenChange }: EditResellerDialogProps) {
  const updateReseller = useUpdateReseller()

  const { register, handleSubmit, reset, setValue, watch } = useForm<EditResellerFormData>({
    resolver: zodResolver(editResellerSchema),
  })

  const statusValue = watch("status")

  useEffect(() => {
    if (reseller) {
      reset({
        name: (reseller.name as string) || "",
        phone: (reseller.phone as string) || "",
        telegramId: (reseller.telegramId as string) || "",
        status: (reseller.status as "ACTIVE" | "INACTIVE") || "ACTIVE",
      })
    }
  }, [reseller, reset])

  function onSubmit(data: EditResellerFormData) {
    if (!reseller) return
    updateReseller.mutate(
      {
        id: reseller.id as string,
        data: {
          name: data.name?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          telegramId: data.telegramId?.trim() || undefined,
          status: data.status,
        },
      },
      {
        onSuccess: () => {
          toast.success("Reseller updated")
          reset()
          onOpenChange(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (!open || !reseller) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Edit Reseller</h3>
            <p className="text-sm text-slate-500">Update reseller information.</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-slate-500 hover:text-[#dae2fd] transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 md:p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Name</label>
              <Input
                className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                {...register("name")}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Phone</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  {...register("phone")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Telegram ID</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  {...register("telegramId")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Status</label>
              <Select value={statusValue || "ACTIVE"} onValueChange={(v) => setValue("status", v as "ACTIVE" | "INACTIVE")}>
                <SelectTrigger className="w-full bg-[#2d3449] border-none text-[#dae2fd] text-sm">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent className="bg-[#2d3449] border-white/10 text-[#dae2fd]">
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-4 md:p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateReseller.isPending}
              className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {updateReseller.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
