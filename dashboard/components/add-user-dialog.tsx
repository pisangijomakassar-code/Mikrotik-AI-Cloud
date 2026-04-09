"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
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
import { useCreateUser } from "@/hooks/use-users"
import { toast } from "sonner"

export function AddUserDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [telegramId, setTelegramId] = useState("")
  const [botToken, setBotToken] = useState("")

  const createUser = useCreateUser()

  function resetForm() {
    setName("")
    setEmail("")
    setPassword("")
    setTelegramId("")
    setBotToken("")
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account for the MikroTik AI Agent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="bg-background border-border"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">Password</Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-telegram">Telegram User ID</Label>
            <Input
              id="user-telegram"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="123456789"
              className="bg-background border-border font-mono"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-bot-token">
              Bot Token{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="user-bot-token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
              className="bg-background border-border font-mono text-xs"
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
              disabled={createUser.isPending}
              className="bg-primary text-primary-foreground"
            >
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
