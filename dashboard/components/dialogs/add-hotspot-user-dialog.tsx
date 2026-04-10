"use client"

import { X } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useAddHotspotUser, useHotspotProfiles } from "@/hooks/use-hotspot"
import { addHotspotUserSchema, type AddHotspotUserFormData } from "@/lib/schemas/hotspot.schema"

interface AddHotspotUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddHotspotUserDialog({ open, onOpenChange }: AddHotspotUserDialogProps) {
  const { data: profiles } = useHotspotProfiles()
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
        comment: data.comment || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Hotspot user added successfully")
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Add Hotspot User</h3>
            <p className="text-sm text-slate-500">Create a new hotspot user account.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Username</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="e.g. user01"
                  type="text"
                  {...register("username")}
                />
                {errors.username?.message && (
                  <p className="text-xs text-red-400 ml-1">{errors.username.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="User password"
                  type="password"
                  {...register("password")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Profile</label>
                <Select value={profileValue || "__default__"} onValueChange={(v) => setValue("profile", v === "__default__" ? "" : v)}>
                  <SelectTrigger className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm text-[#dae2fd]">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d3449] border-white/10 text-[#dae2fd]">
                    <SelectItem value="__default__">Default</SelectItem>
                    {profiles?.map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Server</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="all (default)"
                  type="text"
                  {...register("server")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Limit Uptime</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="e.g. 1h30m"
                  type="text"
                  {...register("limitUptime")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Comment</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="Optional note"
                  type="text"
                  {...register("comment")}
                />
              </div>
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
              disabled={addUser.isPending}
              className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {addUser.isPending ? "Adding..." : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
