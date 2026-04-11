"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Brain, Sparkles, Mail, Lock, Loader2, Wifi, Users, Router, Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const { status } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
    }
  }, [status, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error("Please enter your email and password")
      return
    }
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      })
      if (result?.error) {
        toast.error("Invalid email or password")
      } else {
        router.push("/dashboard")
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: branding (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] shrink-0 flex-col bg-[#060e1e] border-r border-[#4cd7f6]/10 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-80 h-80 bg-[#4cd7f6]/8 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-[#4ae176]/5 rounded-full blur-[80px] translate-x-1/4 translate-y-1/4" />
        </div>

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(76,215,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(76,215,246,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo — mirrors sidebar */}
        <div className="relative z-10 p-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center shadow-[0_0_24px_rgba(76,215,246,0.3)]">
            <Brain className="h-5 w-5 text-[#00424f]" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-linear-to-br from-cyan-400 to-cyan-600 bg-clip-text text-transparent font-headline leading-tight">
              MikroTik AI
            </h1>
            <p className="text-[9px] text-[#4cd7f6]/40 uppercase tracking-widest font-medium">
              AI-Driven Network
            </p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-[#4cd7f6]/5 border border-[#4cd7f6]/15 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 bg-[#4ae176] rounded-full animate-pulse shadow-[0_0_6px_rgba(74,225,118,0.8)]" />
              <span className="text-[10px] text-[#4cd7f6]/70 font-mono-tech uppercase tracking-widest">AI Core Online</span>
            </div>
            <h2 className="font-headline text-3xl font-bold text-white leading-snug mb-3">
              Your AI-powered<br />
              <span className="text-[#4cd7f6]">network manager</span>
            </h2>
            <p className="text-[#869397] text-sm leading-relaxed max-w-xs">
              Manage MikroTik routers with natural language. Monitor, configure, and automate — via Telegram or the web.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              { icon: Bot, label: "AI Agent", desc: "Natural language control" },
              { icon: Wifi, label: "Real-time Monitoring", desc: "Live network stats" },
              { icon: Users, label: "Multi-user", desc: "Full data isolation" },
              { icon: Router, label: "137+ Tools", desc: "Full RouterOS coverage" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-[#4cd7f6]/8 border border-[#4cd7f6]/10 flex items-center justify-center group-hover:border-[#4cd7f6]/25 transition-colors">
                  <Icon className="h-3.5 w-3.5 text-[#4cd7f6]/70" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/80 font-headline">{label}</div>
                  <div className="text-[10px] text-[#869397]">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 p-8 border-t border-white/[0.04]">
          <p className="text-[10px] text-[#869397]/40 font-mono-tech">v2.4.0 · Encrypted · Self-hosted</p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center">
            <Brain className="h-4 w-4 text-[#00424f]" />
          </div>
          <div>
            <span className="font-headline font-bold text-base bg-linear-to-br from-cyan-400 to-cyan-600 bg-clip-text text-transparent">MikroTik AI</span>
          </div>
          <div className="ml-1">
            <Sparkles className="h-3.5 w-3.5 text-[#4ae176]" />
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-headline text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your admin account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pl-9"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 relative overflow-hidden bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold py-2.5 rounded-lg shadow-md shadow-[#4cd7f6]/20 hover:brightness-105 hover:shadow-[#4cd7f6]/30 transition-all active:scale-[0.99] disabled:opacity-60"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </div>
            </button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground/50 text-center">
            Access is managed by your administrator
          </p>
        </div>
      </div>
    </div>
  )
}
