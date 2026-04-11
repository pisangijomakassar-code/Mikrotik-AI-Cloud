"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Router, Sparkles, Mail, Lock, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
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
    <div className="mesh-gradient min-h-screen flex items-center justify-center p-6 overflow-hidden">
      {/* Background glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#4ae176]/5 rounded-full blur-[100px]" />
      </div>

      <main className="relative w-full max-w-105 z-10">
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 scale-150 opacity-15 bg-primary rounded-full blur-2xl" />
            <div className="relative w-16 h-16 bg-card rounded-2xl flex items-center justify-center border border-border shadow-lg">
              <Router className="h-7 w-7 text-primary" />
              <div className="absolute -top-1.5 -right-1.5 bg-card p-1 rounded-full border border-[#4ae176]/40">
                <Sparkles className="h-3.5 w-3.5 text-[#4ae176]" />
              </div>
            </div>
          </div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground">MikroTik AI Agent</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-xl p-8 border border-border">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
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

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
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

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full group relative overflow-hidden bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold py-3 rounded-lg shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.99] disabled:opacity-60 mt-2"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
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
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#4ae176] rounded-full animate-pulse" />
            <span>AI Online</span>
          </div>
          <div className="w-1 h-1 bg-border rounded-full" />
          <span>Secure Connection</span>
        </div>
      </main>

      {/* Decorative router icon */}
      <div className="fixed bottom-0 right-0 p-10 opacity-[0.04] pointer-events-none hidden xl:block">
        <Router className="h-72 w-72 text-primary" />
      </div>
    </div>
  )
}
