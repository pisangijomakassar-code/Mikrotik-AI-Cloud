"use client"

import { useState, useEffect } from "react"
import { X, Eye, EyeOff, Info } from "lucide-react"
import { useUpdateUser } from "@/hooks/use-users"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface EditUserDialogProps {
  user: {
    id: string
    name: string
    email: string | null
    telegramId: string
    botToken: string | null
    role: "ADMIN" | "USER"
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  }
  open: boolean
  onClose: () => void
}

export function EditUserDialog({ user, open, onClose }: EditUserDialogProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email ?? "")
  const [password, setPassword] = useState("")
  const [telegramId, setTelegramId] = useState(user.telegramId)
  const [botToken, setBotToken] = useState(user.botToken ?? "")
  const [showToken, setShowToken] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<"ADMIN" | "USER">(user.role)
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">(user.status)

  const updateUser = useUpdateUser()

  // Re-sync form if user prop changes (e.g. table refreshes)
  useEffect(() => {
    setName(user.name)
    setEmail(user.email ?? "")
    setPassword("")
    setTelegramId(user.telegramId)
    setBotToken(user.botToken ?? "")
    setRole(user.role)
    setStatus(user.status)
  }, [user])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !telegramId.trim()) {
      toast.error("Name and Telegram ID are required")
      return
    }
    updateUser.mutate(
      {
        id: user.id,
        data: {
          name: name.trim(),
          email: email.trim() || undefined,
          telegramId: telegramId.trim(),
          botToken: botToken.trim() || undefined,
          role,
          status,
          ...(password ? { password } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("User updated")
          onClose()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
      <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="p-4 md:p-8 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-headline font-bold text-foreground">Edit User</h3>
            <p className="text-sm text-muted-foreground/70 font-mono-tech">{user.telegramId}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/70 hover:text-foreground transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Full Name</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
                  placeholder="e.g. Pak Budi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Telegram ID</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
                  placeholder="Numeric ID"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Email</label>
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none"
                  placeholder="user@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                  New Password <span className="normal-case font-normal text-muted-foreground/40">(kosong = tidak berubah)</span>
                </label>
                <div className="relative">
                  <Input
                    className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none pr-10"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-primary transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Telegram Bot Token</label>
              <div className="relative">
                <Input
                  className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-foreground outline-none pr-10"
                  placeholder="BotFather generated token"
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-primary transition-colors"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-tertiary/70 italic flex items-center gap-1 mt-1">
                <Info className="h-3 w-3" /> Encrypted at rest using AES-256
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Role</label>
                <Select value={role} onValueChange={(v) => setRole(v as "ADMIN" | "USER")}>
                  <SelectTrigger className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm text-foreground h-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as "ACTIVE" | "INACTIVE" | "SUSPENDED")}>
                  <SelectTrigger className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm text-foreground h-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateUser.isPending}
              className="bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
            >
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
