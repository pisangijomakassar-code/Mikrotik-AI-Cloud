"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Tenant {
  id: string
  name: string
  slug: string
  ownerEmail: string
  status: string
  trialEndsAt: string | null
  expiresAt: string | null
}

interface Props {
  tenant: Tenant | null
  onOpenChange: (v: boolean) => void
  onUpdated: () => void
}

export function EditTenantDialog({ tenant, onOpenChange, onUpdated }: Props) {
  const [form, setForm] = useState({ name: "", ownerEmail: "", status: "", expiresAt: "" })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name,
        ownerEmail: tenant.ownerEmail,
        status: tenant.status,
        expiresAt: tenant.expiresAt ? tenant.expiresAt.slice(0, 10) : "",
      })
    }
  }, [tenant])

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, expiresAt: form.expiresAt || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update tenant")
        return
      }
      toast.success("Tenant updated")
      onUpdated()
      onOpenChange(false)
    } catch {
      toast.error("Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!tenant} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0d1929] border-white/10">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Admin Email</Label>
            <Input type="email" required value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expires At</Label>
              <Input type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
