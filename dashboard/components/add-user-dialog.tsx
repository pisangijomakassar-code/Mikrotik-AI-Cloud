"use client"

import { useState } from "react"
import { UserPlus, X, Eye, EyeOff, Shield, Check, Info } from "lucide-react"
import { useCreateUser } from "@/hooks/use-users"
import { toast } from "sonner"

export function AddUserDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [telegramId, setTelegramId] = useState("")
  const [botToken, setBotToken] = useState("")
  const [showToken, setShowToken] = useState(false)

  const createUser = useCreateUser()

  function resetForm() {
    setName("")
    setEmail("")
    setPassword("")
    setTelegramId("")
    setBotToken("")
    setShowToken(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !telegramId.trim()) {
      toast.error("Name and Telegram ID are required")
      return
    }
    createUser.mutate(
      {
        name: name.trim(),
        email: email.trim() || undefined,
        password: password || undefined,
        telegramId: telegramId.trim(),
        botToken: botToken.trim() || undefined,
        role: "USER",
      },
      {
        onSuccess: () => {
          toast.success("User created successfully")
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
        className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-6 py-3 rounded-lg flex items-center gap-2 shadow-[0_0_32px_rgba(76,215,246,0.15)] hover:scale-[1.02] transition-transform"
      >
        <UserPlus className="h-5 w-5" />
        Add User
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#131b2e] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-headline font-bold text-[#dae2fd]">Provision New User</h3>
                <p className="text-sm text-slate-500">Configure credentials for AI network control.</p>
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="e.g. Pak Budi"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Telegram ID</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="Numeric ID"
                      type="text"
                      value={telegramId}
                      onChange={(e) => setTelegramId(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="user@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none"
                      placeholder="Dashboard login password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Telegram Bot Token</label>
                  <div className="relative">
                    <input
                      className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] placeholder:text-slate-600 transition-all text-[#dae2fd] outline-none pr-10"
                      placeholder="BotFather generated token"
                      type={showToken ? "text" : "password"}
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#4cd7f6] transition-colors"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#4ae176]/70 italic flex items-center gap-1 mt-1">
                    <Info className="h-3 w-3" /> Encrypted at rest using AES-256
                  </p>
                </div>

                {/* AI Permissions */}
                <div className="bg-[#4cd7f6]/5 rounded-2xl p-6 border border-[#4cd7f6]/10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#4cd7f6] flex items-center gap-2">
                      <Shield className="h-4 w-4" /> AI Permissions Level
                    </span>
                    <div className="px-3 py-1 bg-[#4cd7f6] text-[#003640] text-[10px] font-bold rounded-lg">Standard Tier</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="w-5 h-5 rounded border border-white/20 flex items-center justify-center group-hover:border-[#4cd7f6] transition-colors">
                        <Check className="h-3 w-3 text-[#4cd7f6]" />
                      </div>
                      <span className="text-xs text-slate-300">Allow Route Changes</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="w-5 h-5 rounded border border-white/20 flex items-center justify-center group-hover:border-[#4cd7f6] transition-colors">
                        <Check className="h-3 w-3 text-[#4cd7f6]" />
                      </div>
                      <span className="text-xs text-slate-300">View Network Telemetry</span>
                    </label>
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
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={createUser.isPending}
                  className="bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {createUser.isPending ? "Creating..." : "Authorize User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
