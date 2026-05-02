"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, UserCircle, Lock } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Profile {
  id: string
  email: string | null
  name: string | null
  createdAt: string
  lastActiveAt: string | null
}

export default function PlatformProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState("")
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    fetch("/api/platform/profile").then((r) => r.json()).then((d) => {
      setProfile(d)
      setName(d.name ?? "")
    })
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch("/api/platform/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed"); return }
      setProfile(data)
      toast.success("Profile updated")
    } finally { setSavingProfile(false) }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return }
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return }
    setSavingPw(true)
    try {
      const res = await fetch("/api/platform/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed"); return }
      toast.success("Password changed")
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
    } finally { setSavingPw(false) }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1">Profile</h2>
        <p className="text-muted-foreground">Super Admin account settings</p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* Account info */}
        <div className="card-glass rounded-2xl p-6">
          <h3 className="font-headline font-semibold text-foreground mb-4 flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-[#4cd7f6]" /> Account Info
          </h3>
          {profile && (
            <div className="space-y-1 mb-4 text-sm text-[#869397]">
              <p>Email: <span className="text-foreground font-mono">{profile.email}</span></p>
              <p>Member since: {format(new Date(profile.createdAt), "dd MMM yyyy")}</p>
              {profile.lastActiveAt && (
                <p>Last active: {format(new Date(profile.lastActiveAt), "dd MMM yyyy, HH:mm")}</p>
              )}
            </div>
          )}
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Super Admin"
              />
            </div>
            <Button
              type="submit"
              disabled={savingProfile}
              className="bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Profile
            </Button>
          </form>
        </div>

        {/* Change password */}
        <div className="card-glass rounded-2xl p-6">
          <h3 className="font-headline font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#4cd7f6]" /> Change Password
          </h3>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <Button
              type="submit"
              disabled={savingPw}
              variant="outline"
              className="font-headline"
            >
              {savingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Change Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
