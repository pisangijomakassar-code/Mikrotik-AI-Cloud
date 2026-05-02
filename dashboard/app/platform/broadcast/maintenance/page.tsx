"use client"

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Wrench, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Maintenance {
  active: boolean; message: string; startsAt: string | null; endsAt: string | null
}

export default function MaintenancePage() {
  const [data, setData] = useState<Maintenance>({ active: false, message: "", startsAt: null, endsAt: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/platform/broadcast/maintenance")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/platform/broadcast/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setData(updated)
        toast.success("Maintenance notice saved")
      } else toast.error("Failed to save")
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
          <Wrench className="h-7 w-7 text-[#4cd7f6]" /> Maintenance Notice
        </h2>
        <p className="text-muted-foreground">Schedule downtime notice shown to all tenants</p>
      </div>

      <div className="max-w-lg">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : (
          <form onSubmit={handleSave} className="card-glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div>
                <p className="text-sm font-semibold text-foreground">Active</p>
                <p className="text-xs text-[#869397]">Show maintenance banner to all tenants right now</p>
              </div>
              <Switch checked={data.active} onCheckedChange={v => setData(d => ({ ...d, active: v }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={data.message}
                onChange={e => setData(d => ({ ...d, message: e.target.value }))}
                placeholder="Scheduled maintenance: system will be down for upgrades…"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Starts At</Label>
                <Input
                  type="datetime-local"
                  value={data.startsAt ? data.startsAt.slice(0, 16) : ""}
                  onChange={e => setData(d => ({ ...d, startsAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ends At</Label>
                <Input
                  type="datetime-local"
                  value={data.endsAt ? data.endsAt.slice(0, 16) : ""}
                  onChange={e => setData(d => ({ ...d, endsAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                />
              </div>
            </div>

            {data.active && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                <strong>Active:</strong> All tenants will see this banner on their dashboard.
              </div>
            )}

            <Button type="submit" disabled={saving}
              className="w-full bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Notice
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
