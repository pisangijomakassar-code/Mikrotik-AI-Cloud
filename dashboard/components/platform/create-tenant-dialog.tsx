"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}

export function CreateTenantDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    ownerEmail: "",
    ownerPassword: "",
    status: "TRIAL",
    trialDays: "14",
    expiresAt: "",
  })
  const [loading, setLoading] = useState(false)

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          trialDays: Number(form.trialDays),
          expiresAt: form.expiresAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create tenant")
        return
      }
      toast.success(`Tenant "${data.name}" created`)
      onCreated()
      onOpenChange(false)
      setForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "", status: "TRIAL", trialDays: "14", expiresAt: "" })
    } catch {
      toast.error("Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0d1929] border-white/10">
        <DialogHeader>
          <DialogTitle className="font-headline">New Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input
                required
                placeholder="bukakaNet"
                value={form.name}
                onChange={(e) => {
                  set("name", e.target.value)
                  if (!form.slug) set("slug", autoSlug(e.target.value))
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (unique)</Label>
              <Input
                required
                placeholder="bukakanet"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Admin Email</Label>
            <Input
              type="email"
              required
              placeholder="admin@bukakanet.id"
              value={form.ownerEmail}
              onChange={(e) => set("ownerEmail", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Admin Password</Label>
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={form.ownerPassword}
              onChange={(e) => set("ownerPassword", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.status === "TRIAL" ? (
              <div className="space-y-1.5">
                <Label>Trial Days</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={form.trialDays}
                  onChange={(e) => set("trialDays", e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Expires At</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set("expiresAt", e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
