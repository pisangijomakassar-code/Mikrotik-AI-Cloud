"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Megaphone, Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Announcement {
  id: string; title: string; body: string; type: string; active: boolean; createdAt: string
}

const TYPE_COLORS: Record<string, string> = {
  info: "bg-[#4cd7f6]/15 text-[#4cd7f6]",
  warning: "bg-amber-500/15 text-amber-400",
  critical: "bg-red-500/15 text-red-400",
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [type, setType] = useState("info")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/broadcast/announcements")
      if (res.ok) setItems(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/platform/broadcast/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, type }),
      })
      if (res.ok) {
        toast.success("Announcement created")
        setTitle(""); setBody(""); setType("info"); setShowForm(false)
        load()
      } else {
        const d = await res.json()
        toast.error(d.error ?? "Failed")
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/platform/broadcast/announcements/${id}`, { method: "DELETE" })
      if (res.ok) { toast.success("Deleted"); setItems(prev => prev.filter(a => a.id !== id)) }
      else toast.error("Failed to delete")
    } finally { setDeleting(null) }
  }

  async function handleToggle(id: string, active: boolean) {
    setToggling(id)
    try {
      const res = await fetch(`/api/platform/broadcast/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      if (res.ok) setItems(prev => prev.map(a => a.id === id ? { ...a, active } : a))
      else toast.error("Failed to update")
    } finally { setToggling(null) }
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
            <Megaphone className="h-7 w-7 text-[#4cd7f6]" /> Announcements
          </h2>
          <p className="text-muted-foreground">
            {loading ? "Loading…" : `${items.length} announcement${items.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}
          className="bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold">
          <Plus className="h-4 w-4 mr-1.5" /> New
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card-glass rounded-2xl p-6 mb-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title…" required />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Announcement body…" rows={3} required />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}
              className="bg-[#4cd7f6] text-[#003640] hover:brightness-105 font-headline font-bold">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create
            </Button>
          </div>
        </form>
      )}

      <div className="card-glass rounded-2xl divide-y divide-white/[0.05]">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No announcements yet</div>
        ) : (
          items.map(ann => (
            <div key={ann.id} className="flex items-start justify-between gap-4 p-4 hover:bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[ann.type] ?? TYPE_COLORS.info}`}>
                    {ann.type.toUpperCase()}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ann.active ? "bg-[#4ae176]/15 text-[#4ae176]" : "bg-zinc-500/15 text-zinc-400"}`}>
                    {ann.active ? "ACTIVE" : "HIDDEN"}
                  </span>
                  <span className="text-[10px] text-[#869397]">{format(new Date(ann.createdAt), "dd MMM yyyy, HH:mm")}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{ann.title}</p>
                <p className="text-xs text-[#869397] mt-0.5 line-clamp-2">{ann.body}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch
                  checked={ann.active}
                  disabled={toggling === ann.id}
                  onCheckedChange={(v) => handleToggle(ann.id, v)}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300"
                  disabled={deleting === ann.id}
                  onClick={() => handleDelete(ann.id)}>
                  {deleting === ann.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
