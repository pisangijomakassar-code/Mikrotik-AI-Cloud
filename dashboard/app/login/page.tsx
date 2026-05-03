"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Brain, Sparkles, Mail, Lock, Loader2, Wifi, Users, Router, Bot, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Multi-tenant: redirect berdasarkan role.
// SUPER_ADMIN → /platform/dashboard (SaaS console).
// ADMIN/USER → /dashboard (tenant operations).
function landingPathForRole(role: string | undefined): string {
  return role === "SUPER_ADMIN" ? "/platform/dashboard" : "/dashboard"
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const error = searchParams.get("error")
    if (error === "not_registered") {
      toast.error("Email tidak terdaftar. Hubungi administrator untuk mendapatkan akses.")
    }
  }, [searchParams])

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(landingPathForRole(session?.user?.role))
    }
  }, [status, session?.user?.role, router])

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true)
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch {
      toast.error("Gagal login dengan Google")
      setIsGoogleLoading(false)
    }
  }

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
        // Tunggu session update lewat useEffect — redirect otomatis berdasarkan role.
        // Fallback: kalau session belum sync, push ke /dashboard (tenant default).
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
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pl-9 pr-10 [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-[#869397] hover:text-[#4cd7f6] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
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

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground/50">atau</span>
            </div>
          </div>

          {/* Google login */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 border border-border/60 rounded-lg py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>Lanjutkan dengan Google</span>
          </button>

          <p className="mt-6 text-xs text-muted-foreground/50 text-center">
            Access is managed by your administrator
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
