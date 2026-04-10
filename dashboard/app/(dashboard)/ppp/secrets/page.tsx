"use client"

import { useState } from "react"
import { Network, PlusCircle, Trash2, X, Search, UserX } from "lucide-react"
import { usePPPSecrets, usePPPProfiles, useAddPPPSecret, useRemovePPPSecret } from "@/hooks/use-ppp"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

function AddPPPSecretDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [service, setService] = useState("any")
  const [profile, setProfile] = useState("")
  const [localAddress, setLocalAddress] = useState("")
  const [remoteAddress, setRemoteAddress] = useState("")
  const [comment, setComment] = useState("")

  const { data: profiles } = usePPPProfiles()
  const addSecret = useAddPPPSecret()

  function resetForm() {
    setName("")
    setPassword("")
    setService("any")
    setProfile("")
    setLocalAddress("")
    setRemoteAddress("")
    setComment("")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!password) {
      toast.error("Password is required")
      return
    }
    addSecret.mutate(
      {
        name: name.trim(),
        password,
        service: service || undefined,
        profile: profile || undefined,
        "local-address": localAddress || undefined,
        "remote-address": remoteAddress || undefined,
        comment: comment || undefined,
      },
      {
        onSuccess: () => {
          toast.success("PPP secret added successfully")
          resetForm()
          onClose()
        },
        onError: (err) => {
          toast.error(err.message)
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
      <div className="w-full max-w-xl bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Add PPP Secret</h3>
            <p className="text-sm text-slate-500">Create a new PPP user account.</p>
          </div>
          <button
            onClick={() => { onClose(); resetForm() }}
            className="text-slate-500 hover:text-[#dae2fd] transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Name</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="e.g. pppoe-user01"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="User password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Service</label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm text-[#dae2fd]">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d3449] border-white/10 text-[#dae2fd]">
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Profile</label>
                <Select value={profile || "__default__"} onValueChange={(v) => setProfile(v === "__default__" ? "" : v)}>
                  <SelectTrigger className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm text-[#dae2fd]">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d3449] border-white/10 text-[#dae2fd]">
                    <SelectItem value="__default__">Default</SelectItem>
                    {profiles?.map((p: { name: string }) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Local Address</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="e.g. 10.0.0.1"
                  type="text"
                  value={localAddress}
                  onChange={(e) => setLocalAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Remote Address</label>
                <Input
                  className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                  placeholder="e.g. 10.0.0.100"
                  type="text"
                  value={remoteAddress}
                  onChange={(e) => setRemoteAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Comment</label>
              <Input
                className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                placeholder="Optional note"
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>

          <div className="p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => { onClose(); resetForm() }}
              className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addSecret.isPending}
              className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {addSecret.isPending ? "Adding..." : "Add Secret"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PPPSecretsPage() {
  const [search, setSearch] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const { data: secrets, isLoading } = usePPPSecrets()
  const removeSecret = useRemovePPPSecret()

  const filteredSecrets = secrets?.filter((s: Record<string, unknown>) => {
    if (!search) return true
    const name = (s.name as string) || ""
    return name.toLowerCase().includes(search.toLowerCase())
  })

  function handleDelete(name: string) {
    removeSecret.mutate(name, {
      onSuccess: () => toast.success(`Secret "${name}" deleted`),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">PPP Users</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <Network className="h-[18px] w-[18px] text-[#4cd7f6]" />
            Manage PPP secret accounts for PPPoE, PPTP, L2TP connections.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4" />
            Add Secret
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#131b2e] border border-white/5 rounded-lg text-sm pl-10 pr-4 py-2.5 text-[#dae2fd] placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-[#4cd7f6]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#131b2e] rounded-3xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Service</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Profile</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Local Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Remote Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Comment</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-5">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !filteredSecrets?.length ? (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <UserX className="h-10 w-10 text-slate-500/50" />
                      <p className="text-sm text-slate-400">No PPP secrets found</p>
                      <p className="text-[10px] text-slate-600">Add a secret to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSecrets.map((secret: Record<string, unknown>) => {
                  const disabled = secret.disabled === true || secret.disabled === "true"
                  return (
                    <tr key={secret.name as string} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-[#dae2fd]">{secret.name as string}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-[#222a3d] text-[#4cd7f6] font-medium uppercase">
                          {(secret.service as string) || "any"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-400">
                        {(secret.profile as string) || "--"}
                      </td>
                      <td className="px-6 py-5 font-mono-tech text-sm text-slate-400">
                        {(secret["local-address"] as string) || "--"}
                      </td>
                      <td className="px-6 py-5 font-mono-tech text-sm text-slate-400">
                        {(secret["remote-address"] as string) || "--"}
                      </td>
                      <td className="px-6 py-5">
                        {disabled ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-[#93000a]/20 text-[#ffb4ab] font-medium">
                            Disabled
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-[#4ae176]/10 text-[#4ae176] font-medium">
                            Enabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-400 max-w-[160px] truncate">
                        {(secret.comment as string) || "--"}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <ConfirmDialog
                          trigger={
                            <button className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-500 hover:text-[#ffb4ab] transition-colors flex items-center justify-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          }
                          title={`Delete "${secret.name}"?`}
                          description="This will permanently remove this PPP secret. This action cannot be undone."
                          confirmText="Delete Secret"
                          variant="destructive"
                          onConfirm={() => handleDelete(secret.name as string)}
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-900/50 flex items-center justify-between border-t border-white/5">
          <span className="text-xs text-slate-500">
            Showing {filteredSecrets?.length ?? 0} of {secrets?.length ?? 0} secrets
          </span>
        </div>
      </div>

      {showAddDialog && <AddPPPSecretDialog onClose={() => setShowAddDialog(false)} />}
    </div>
  )
}
