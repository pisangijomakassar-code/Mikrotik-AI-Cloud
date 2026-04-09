"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Router
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Router</DialogTitle>
          <DialogDescription>
            Connect a MikroTik router to the management system.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="router-name">Router Name</Label>
            <Input
              id="router-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Office Main Router"
              className="bg-background border-border"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="router-host">Host / IP</Label>
              <Input
                id="router-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1"
                className="bg-background border-border font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="router-port">Port</Label>
              <Input
                id="router-port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8728"
                className="bg-background border-border font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="router-username">Username</Label>
            <Input
              id="router-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="bg-background border-border"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="router-password">Password</Label>
            <Input
              id="router-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Router API password"
              className="bg-background border-border"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="router-label">
              Label{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="router-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Branch Office"
              className="bg-background border-border"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label htmlFor="router-default" className="cursor-pointer">
              Set as default router
            </Label>
            <Switch
              id="router-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              size="sm"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createRouter.isPending}
              className="bg-primary text-primary-foreground"
            >
              {createRouter.isPending ? "Adding..." : "Add Router"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
