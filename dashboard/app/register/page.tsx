"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Radio, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [telegramId, setTelegramId] = useState("")
  const [botToken, setBotToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password || !telegramId.trim()) {
      toast.error("Please fill in all required fields")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          telegramId: telegramId.trim(),
          botToken: botToken.trim() || undefined,
          role: "USER",
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Registration failed" }))
        throw new Error(err.error || "Registration failed")
      }

      toast.success("Account created! Please sign in.")
      router.push("/login")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4cd7f6]/10">
            <Radio className="h-6 w-6 text-[#4cd7f6]" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-[#4cd7f6]" style={{ fontFamily: "var(--font-display)" }}>
              MikroTik AI Agent
            </h1>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-body)" }}>
              Create your account
            </p>
          </div>
        </div>

        <Card className="border-0 bg-[#171f33]/80 backdrop-blur-xl" style={{ boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Register</CardTitle>
            <CardDescription>
              Set up your account to manage MikroTik routers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name">Name</Label>
                <Input
                  id="reg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="bg-[#222a3d] border-0 focus:ring-[#4cd7f6] focus:ring-1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-[#222a3d] border-0 focus:ring-[#4cd7f6] focus:ring-1"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="bg-[#222a3d] border-0 focus:ring-[#4cd7f6] focus:ring-1"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-telegram">Telegram User ID</Label>
                <Input
                  id="reg-telegram"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  placeholder="123456789"
                  className="bg-[#222a3d] border-0 focus:ring-[#4cd7f6] focus:ring-1 font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-bot-token">
                  Telegram Bot Token{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="reg-bot-token"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="110201543:AAHdqTcvCH1vGWJxfSe..."
                  className="bg-[#222a3d] border-0 focus:ring-[#4cd7f6] focus:ring-1 font-mono text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full text-[#003640] font-semibold hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #4cd7f6, #06b6d4)' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
