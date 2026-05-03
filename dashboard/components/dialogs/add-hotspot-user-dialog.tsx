"use client"

import { X } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useAddHotspotUser, useHotspotProfiles } from "@/hooks/use-hotspot"
import { addHotspotUserSchema, type AddHotspotUserFormData } from "@/lib/schemas/hotspot.schema"
import { useActiveRouter } from "@/components/active-router-context"

interface AddHotspotUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddHotspotUserDialog({ open, onOpenChange }: AddHotspotUserDialogProps) {
  const { activeRouter } = useActiveRouter()
  const { data: profiles } = useHotspotProfiles(activeRouter || undefined)
  const addUser = useAddHotspotUser()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddHotspotUserFormData>({
    resolver: zodResolver(addHotspotUserSchema),
    defaultValues: {
      username: "",
      password: "",
      profile: "",
      server: "",
      limitUptime: "",
      limitBytesTotal: "",
      limitBytesIn: "",
      limitBytesOut: "",
      comment: "",
    },
  })

  if (!open) return null

  const profileValue = watch("profile")

  function onSubmit(data: AddHotspotUserFormData) {
    addUser.mutate(
      {
        name: data.username,
        password: data.password || undefined,
        profile: data.profile || undefined,
        server: data.server || undefined,
        "limit-uptime": data.limitUptime || undefined,
        "limit-bytes-total": data.limitBytesTotal || undefined,
        "limit-bytes-in": data.limitBytesIn || undefined,
        "limit-bytes-out": data.limitBytesOut || undefined,
        comment: data.comment || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Hotspot user berhasil ditambahkan")
          reset()
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(err.message)
        },
      }
    )
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  const inputClass = "w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">Tambah Hotspot User</h3>
            <p className="text-sm text-muted-foreground/70">Buat akun hotspot user baru.</p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 md:p-8 space-y-5 overflow-y-auto flex-1">
            {/* Username & Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Username *</label>
                <Input className={inputClass} placeholder="e.g. user01" {...register("username")} />
                {errors.username?.message && <p className="text-xs text-destructive ml-1">{errors.username.message}</p>}
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Password</label>
                <Input className={inputClass} placeholder="Password user" type="password" {...register("password")} />
              </div>
            </div>

            {/* Profile & Server */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Profile</label>
                <Select value={profileValue || "__default__"} onValueChange={(v) => setValue("profile", v === "__default__" ? "" : v)}>
                  <SelectTrigger className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm text-foreground">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="__default__">Default</SelectItem>
                    {profiles?.map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Server</label>
                <Input className={inputClass} placeholder="all (default)" {...register("server")} />
              </div>
            </div>

            {/* Limit Uptime & Comment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Limit Uptime</label>
                <Input className={inputClass} placeholder="e.g. 1h30m, 1d" {...register("limitUptime")} />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Komentar</label>
                <Input className={inputClass} placeholder="Catatan opsional" {...register("comment")} />
              </div>
            </div>

            {/* Quota section */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1 border-t border-border pt-3">Limit Kuota</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className={labelClass}>Total Kuota</label>
                  <Input className={inputClass} placeholder="e.g. 1G, 500M" {...register("limitBytesTotal")} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Limit Download</label>
                  <Input className={inputClass} placeholder="e.g. 500M" {...register("limitBytesIn")} />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Limit Upload</label>
                  <Input className={inputClass} placeholder="e.g. 100M" {...register("limitBytesOut")} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4 shrink-0">
            <button type="button" onClick={handleClose} className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={addUser.isPending}
              className="bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {addUser.isPending ? "Menambahkan..." : "Tambah User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
