"use client"

import { useState } from "react"
import { PlusCircle, X } from "lucide-react"
import { useCreateRouter } from "@/hooks/use-routers"
import { toast } from "sonner"

export function AddRouterDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("8728")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [label, setLabel] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  const createRouter = useCreateRouter()

  function resetForm() {
    setName("")
    setHost("")
    setPort("8728")
    setUsername("")
    setPassword("")
    setLabel("")
    setIsDefault(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !host.trim() || !username.trim() || !password) {
      toast.error("Name, host, username, and password are required")
      return
    }
    createRouter.mutate(
      {
        name: name.trim(),
        host: host.trim(),
        port: parseInt(port) || 8728,
        username: username.trim(),
        password,
        label: label.trim() || undefined,
        isDefault,
        userId: "",
      },
      {
        onSuccess: () => {
          toast.success("Router added successfully")
          resetForm()
          setOpen(false)
        },
        onError: (err) => {
          toast.error(err.message)
        },
      }
    )
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
      >
        <PlusCircle className="h-4 w-4" />
        Provision Node
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Provision Node</h3>
                <p className="text-sm text-slate-500">Add a new MikroTik router to the management system.</p>
              </div>
              <button
                onClick={() => { setOpen(false); resetForm() }}
                className="text-slate-500 hover:text-[#dae2fd] transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit}>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Router Name</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="e.g. HQ-Core-CCR2004"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Label (Optional)</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="e.g. Branch Office"
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Host / IP Address</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="192.168.88.1"
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Port</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="8728"
                      type="text"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Username</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="admin"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="Router API password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-[#222a3d]/50 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-300">Set as default router</span>
                  <div
                    className={`w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors ${isDefault ? 'bg-[#4ae176]/20' : 'bg-slate-800'}`}
                    onClick={() => setIsDefault(!isDefault)}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${isDefault ? 'right-1 bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.5)]' : 'left-1 bg-slate-600'}`} />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-8 bg-[#222a3d]/50 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => { setOpen(false); resetForm() }}
                  className="px-6 py-2.5 text-slate-400 hover:text-[#dae2fd] font-headline font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRouter.isPending}
                  className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {createRouter.isPending ? "Adding..." : "Add Router"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
