"use client"

import { useState, useEffect } from "react"
import { User, Mail, MessageSquare, Shield, Router, Calendar, Pencil, Check, X, Loader2, Lock, Eye, EyeOff, KeyRound, Bell, BellOff, ShieldAlert, CalendarClock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface ProfileData {
  id: string
  name: string
  email: string | null
  telegramId: string
  botToken: string | null
  role: "ADMIN" | "USER"
  status: string
  createdAt: string
  lastActiveAt: string | null
  validUntil: string | null
  isLocked: boolean
  notifAsOwner: boolean
  notifAsReseller: boolean
  _count: { routers: number }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<"name" | "email" | "telegramId" | "botToken" | "validUntil" | null>(null)
  const [showBotToken, setShowBotToken] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  // Change password state
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then(setProfile)
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSave() {
    if (!editing || !profile) return
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [editing]: editValue }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const updated = await res.json()
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
      const labelMap = { name: "Nama", email: "Email", telegramId: "Telegram ID", botToken: "Bot Token", validUntil: "Masa berlaku" }
      toast.success(`${labelMap[editing]} berhasil diubah`)
      setEditing(null)
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(field: "name" | "email" | "telegramId" | "botToken" | "validUntil") {
    setEditing(field)
    if (field === "name") setEditValue(profile?.name ?? "")
    else if (field === "email") setEditValue(profile?.email ?? "")
    else if (field === "telegramId") setEditValue(profile?.telegramId ?? "")
    else if (field === "botToken") setEditValue(profile?.botToken ?? "")
    else if (field === "validUntil") setEditValue(profile?.validUntil ? profile.validUntil.slice(0, 10) : "")
  }

  async function toggleField(field: "isLocked" | "notifAsOwner" | "notifAsReseller") {
    if (!profile) return
    const newValue = !profile[field]
    setProfile({ ...profile, [field]: newValue })
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch {
      setProfile({ ...profile, [field]: !newValue })
      toast.error("Gagal mengubah pengaturan")
    }
  }

  async function handleChangePassword() {
    if (!newPassword || !oldPassword) {
      toast.error("Semua field password wajib diisi")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok")
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Gagal mengubah password")
      }
      toast.success("Password berhasil diubah")
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah password")
    } finally {
      setSavingPassword(false)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!profile) return null

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-headline font-bold text-foreground tracking-tight mb-2">Profile</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <User className="h-[18px] w-[18px] text-primary shrink-0" />
            Your account details and preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-surface-low rounded-2xl border border-border/20 p-8 flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
            </div>
            <h3 className="text-xl font-headline font-bold text-foreground">{profile.name}</h3>
            <p className="text-sm text-slate-400 mt-1">{profile.email || "No email set"}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                profile.role === "ADMIN"
                  ? "bg-[#4cd7f6]/10 text-primary border border-[#4cd7f6]/20"
                  : "bg-[#4ae176]/10 text-tertiary border border-[#4ae176]/20"
              }`}>
                {profile.role}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-[#4ae176]/10 text-tertiary border border-[#4ae176]/20">
                {profile.status}
              </span>
            </div>

            <div className="w-full mt-8 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Router className="h-4 w-4 text-slate-500" />
                <span className="text-slate-400">{profile._count.routers} routers</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-slate-400">Joined {formatDate(profile.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-slate-500" />
                <span className="text-slate-400">
                  Agent {profile.botToken && profile.telegramId ? "configured" : "not configured"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Name */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Full Name</span>
              </div>
              {editing !== "name" && (
                <button
                  onClick={() => startEdit("name")}
                  className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing === "name" ? (
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button onClick={handleSave} disabled={saving} className="p-2 text-tertiary hover:bg-[#4ae176]/10 rounded-lg transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:bg-muted/50 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-foreground font-medium">{profile.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email</span>
              </div>
              {editing !== "email" && (
                <button
                  onClick={() => startEdit("email")}
                  className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing === "email" ? (
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  type="email"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button onClick={handleSave} disabled={saving} className="p-2 text-tertiary hover:bg-[#4ae176]/10 rounded-lg transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:bg-muted/50 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-foreground font-medium">{profile.email || "Not set"}</p>
            )}
          </div>

          {/* Telegram ID */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Telegram ID</span>
              </div>
              {editing !== "telegramId" && (
                <button onClick={() => startEdit("telegramId")} className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing === "telegramId" ? (
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 bg-muted border-none rounded-lg text-sm text-foreground font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  placeholder="e.g. 421687437"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button onClick={handleSave} disabled={saving} className="p-2 text-tertiary hover:bg-[#4ae176]/10 rounded-lg transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:bg-muted/50 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-foreground font-mono-tech">{profile.telegramId || <span className="text-slate-500 text-sm">Belum diset</span>}</p>
            )}
          </div>

          {/* Bot Token */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Bot Token</span>
              </div>
              {editing !== "botToken" && (
                <button onClick={() => startEdit("botToken")} className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing === "botToken" ? (
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 bg-muted border-none rounded-lg text-sm text-foreground font-mono-tech focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  type={showBotToken ? "text" : "password"}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  placeholder="123456:ABC-DEF..."
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button type="button" onClick={() => setShowBotToken(!showBotToken)} className="p-2 text-slate-400 hover:text-primary rounded-lg transition-colors">
                  {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={handleSave} disabled={saving} className="p-2 text-tertiary hover:bg-[#4ae176]/10 rounded-lg transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:bg-muted/50 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-foreground font-mono-tech">
                {profile.botToken ? "••••••••••••••••" : <span className="text-slate-500 text-sm">Belum diset</span>}
              </p>
            )}
          </div>

          {/* Masa Berlaku */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Masa Berlaku</span>
              </div>
              {editing !== "validUntil" && (
                <button onClick={() => startEdit("validUntil")} className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing === "validUntil" ? (
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  className="flex-1 bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <button onClick={handleSave} disabled={saving} className="p-2 text-tertiary hover:bg-[#4ae176]/10 rounded-lg transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:bg-muted/50 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-foreground">
                {profile.validUntil ? formatDate(profile.validUntil) : <span className="text-slate-500 text-sm">Tidak ada batas</span>}
              </p>
            )}
          </div>

          {/* Toggles: Lock User, Notif Owner, Notif Reseller */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pengaturan Akun</span>
            </div>

            {/* Lock User */}
            <button
              type="button"
              onClick={() => toggleField("isLocked")}
              className="w-full flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-3 text-left">
                <ShieldAlert className={`h-5 w-5 ${profile.isLocked ? "text-red-400" : "text-slate-500"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">Kunci Akun</p>
                  <p className="text-xs text-slate-500">Akun terkunci tidak bisa login</p>
                </div>
              </div>
              <div className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${profile.isLocked ? "bg-red-500" : "bg-muted"}`}>
                <span className={`inline-block h-5 w-5 my-0.5 rounded-full bg-white shadow transition-transform ${profile.isLocked ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </button>

            {/* Notif Owner */}
            <button
              type="button"
              onClick={() => toggleField("notifAsOwner")}
              className="w-full flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-3 text-left">
                {profile.notifAsOwner ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-slate-500" />}
                <div>
                  <p className="text-sm font-medium text-foreground">Notif Telegram (sbg Owner)</p>
                  <p className="text-xs text-slate-500">Terima notifikasi deposit & aktivitas reseller</p>
                </div>
              </div>
              <div className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${profile.notifAsOwner ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-5 w-5 my-0.5 rounded-full bg-white shadow transition-transform ${profile.notifAsOwner ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </button>

            {/* Notif Reseller */}
            <button
              type="button"
              onClick={() => toggleField("notifAsReseller")}
              className="w-full flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-3 text-left">
                {profile.notifAsReseller ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-slate-500" />}
                <div>
                  <p className="text-sm font-medium text-foreground">Notif Telegram (sbg Reseller)</p>
                  <p className="text-xs text-slate-500">Terima notifikasi pembelian voucher & saldo</p>
                </div>
              </div>
              <div className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${profile.notifAsReseller ? "bg-primary" : "bg-muted"}`}>
                <span className={`inline-block h-5 w-5 my-0.5 rounded-full bg-white shadow transition-transform ${profile.notifAsReseller ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </button>
          </div>

          {/* Last Active */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Active</span>
            </div>
            <p className="text-lg text-foreground">{formatDate(profile.lastActiveAt)}</p>
          </div>

          {/* Change Password */}
          <div className="bg-surface-low rounded-2xl border border-border/20 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ganti Password</span>
            </div>
            <div className="space-y-4">
              {/* Old password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password Lama</label>
                <div className="relative">
                  <Input
                    type={showOld ? "text" : "password"}
                    className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] outline-none pr-10"
                    placeholder="••••••••"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-slate-500 hover:text-primary transition-colors" tabIndex={-1}>
                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {/* New password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password Baru</label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] outline-none pr-10"
                    placeholder="Min. 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-slate-500 hover:text-primary transition-colors" tabIndex={-1}>
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Konfirmasi Password Baru</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    className="bg-muted border-none rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#4cd7f6] outline-none pr-10"
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-slate-500 hover:text-primary transition-colors" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
                className="mt-2 bg-linear-to-br from-primary to-primary-container text-primary-foreground font-headline font-bold px-6 py-2.5 rounded-lg hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {savingPassword ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Password"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
