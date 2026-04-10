"use client"

import { useState, useEffect } from "react"
import { User, Mail, MessageSquare, Shield, Router, Calendar, Pencil, Check, X, Loader2 } from "lucide-react"
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
  _count: { routers: number }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<"name" | "email" | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

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
      toast.success(`${editing === "name" ? "Name" : "Email"} updated`)
      setEditing(null)
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(field: "name" | "email") {
    setEditing(field)
    setEditValue(field === "name" ? profile?.name ?? "" : profile?.email ?? "")
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
        <Loader2 className="h-8 w-8 text-[#4cd7f6] animate-spin" />
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
          <h2 className="text-4xl font-headline font-bold text-[#dae2fd] tracking-tight mb-2">Profile</h2>
          <p className="text-[#bcc9cd] flex items-center gap-2">
            <User className="h-[18px] w-[18px] text-[#4cd7f6] shrink-0" />
            Your account details and preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-8 flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-[#003640]">{initials}</span>
            </div>
            <h3 className="text-xl font-headline font-bold text-[#dae2fd]">{profile.name}</h3>
            <p className="text-sm text-slate-400 mt-1">{profile.email || "No email set"}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                profile.role === "ADMIN"
                  ? "bg-[#4cd7f6]/10 text-[#4cd7f6] border border-[#4cd7f6]/20"
                  : "bg-[#4ae176]/10 text-[#4ae176] border border-[#4ae176]/20"
              }`}>
                {profile.role}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-[#4ae176]/10 text-[#4ae176] border border-[#4ae176]/20">
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
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Full Name</span>
              </div>
              {editing !== "name" && (
                <button
                  onClick={() => startEdit("name")}
                  className="text-xs text-slate-400 hover:text-[#4cd7f6] flex items-center gap-1 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing === "name" ? (
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 bg-[#222a3d] border-none rounded-lg text-sm text-[#dae2fd] focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button onClick={handleSave} disabled={saving} className="p-2 text-[#4ae176] hover:bg-[#4ae176]/10 rounded-lg transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:bg-white/5 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-[#dae2fd] font-medium">{profile.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email</span>
              </div>
              {editing !== "email" && (
                <button
                  onClick={() => startEdit("email")}
                  className="text-xs text-slate-400 hover:text-[#4cd7f6] flex items-center gap-1 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>
            {editing === "email" ? (
              <div className="flex items-center gap-3">
                <Input
                  className="flex-1 bg-[#222a3d] border-none rounded-lg text-sm text-[#dae2fd] focus:ring-1 focus:ring-[#4cd7f6] outline-none"
                  type="email"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                <button onClick={handleSave} disabled={saving} className="p-2 text-[#4ae176] hover:bg-[#4ae176]/10 rounded-lg transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditing(null)} className="p-2 text-slate-400 hover:bg-white/5 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-lg text-[#dae2fd] font-medium">{profile.email || "Not set"}</p>
            )}
          </div>

          {/* Telegram ID (read-only) */}
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Telegram ID</span>
            </div>
            <p className="text-lg text-[#dae2fd] font-mono-tech">{profile.telegramId}</p>
          </div>

          {/* Last Active */}
          <div className="bg-[#131b2e] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Active</span>
            </div>
            <p className="text-lg text-[#dae2fd]">{formatDate(profile.lastActiveAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
