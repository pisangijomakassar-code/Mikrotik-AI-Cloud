"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { toast } from "sonner"
import { addPPPSecretSchema, type AddPPPSecretFormData } from "@/lib/schemas/ppp.schema"
import { useAddPPPSecret, usePPPProfiles } from "@/hooks/use-ppp"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AddPPPSecretDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPPPSecretDialog({ open, onOpenChange }: AddPPPSecretDialogProps) {
  const { data: profiles } = usePPPProfiles()
  const addSecret = useAddPPPSecret()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddPPPSecretFormData>({
    resolver: zodResolver(addPPPSecretSchema),
    defaultValues: { service: "any" },
  })

  const service = watch("service")
  const profile = watch("profile")

  if (!open) return null

  function onSubmit(data: AddPPPSecretFormData) {
    addSecret.mutate(
      {
        name: data.name,
        password: data.password,
        service: data.service || undefined,
        profile: data.profile || undefined,
        "local-address": data.localAddress || undefined,
        "remote-address": data.remoteAddress || undefined,
        comment: data.comment || undefined,
      },
      {
        onSuccess: () => {
          toast.success("PPP secret added successfully")
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

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">Add PPP Secret</h3>
            <p className="text-sm text-muted-foreground/70">Create a new PPP user account.</p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Name</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="e.g. pppoe-user01"
                  type="text"
                  {...register("name")}
                />
                {errors.name?.message && (
                  <p className="text-xs text-[#ffb4ab] ml-1">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Password</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="User password"
                  type="password"
                  {...register("password")}
                />
                {errors.password?.message && (
                  <p className="text-xs text-[#ffb4ab] ml-1">{errors.password.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Service</label>
                <Select value={service} onValueChange={(v) => setValue("service", v)}>
                  <SelectTrigger className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm text-foreground">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="pppoe">PPPoE</SelectItem>
                    <SelectItem value="pptp">PPTP</SelectItem>
                    <SelectItem value="l2tp">L2TP</SelectItem>
                    <SelectItem value="ovpn">OVPN</SelectItem>
                    <SelectItem value="sstp">SSTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Profile</label>
                <Select value={profile || "__default__"} onValueChange={(v) => setValue("profile", v === "__default__" ? "" : v)}>
                  <SelectTrigger className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm text-foreground">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="__default__">Default</SelectItem>
                    {(profiles as { name: string }[] | undefined)?.map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Local Address</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="e.g. 10.0.0.1"
                  type="text"
                  {...register("localAddress")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Remote Address</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                  placeholder="e.g. 10.0.0.100"
                  type="text"
                  {...register("remoteAddress")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Comment</label>
              <Input
                className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                placeholder="Optional note"
                type="text"
                {...register("comment")}
              />
            </div>
          </div>

          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addSecret.isPending}
              className="bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {addSecret.isPending ? "Adding..." : "Add Secret"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
