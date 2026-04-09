"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Router, Sparkles, AtSign, Lock, LogIn, ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
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
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4cd7f6]/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#4ae176]/5 rounded-full blur-[96px]" />
      </div>

      {/* Login Container */}
      <main className="relative w-full max-w-[440px] z-10">
        {/* Branding Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-6">
            {/* Node Pulse Effect */}
            <div className="absolute inset-0 scale-150 opacity-20 bg-[#4cd7f6] rounded-full blur-xl" />
            <div className="relative w-20 h-20 bg-[#2d3449] rounded-full flex items-center justify-center border border-white/10 shadow-2xl">
              <Router className="h-9 w-9 text-[#4cd7f6]" />
              <div className="absolute -top-1 -right-1 bg-[#2d3449] p-1.5 rounded-full border border-[#4ae176]/30 shadow-[0_0_15px_rgba(74,225,118,0.3)]">
                <Sparkles className="h-4 w-4 text-[#4ae176]" />
              </div>
            </div>
          </div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-[#dae2fd] mb-2">MikroTik AI Agent</h1>
          <p className="text-[#bcc9cd] font-medium tracking-wide">Manage your routers with AI</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-[0.75rem] p-8 shadow-2xl border border-white/5">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input Group: Email */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[#4cd7f6]/70 ml-1" htmlFor="email">
                Network Identity
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AtSign className="h-[18px] w-[18px] text-[#869397] group-focus-within:text-[#4cd7f6] transition-colors" />
                </div>
                <input
                  className="w-full bg-[#2d3449]/50 border border-transparent focus:border-[#4cd7f6]/50 focus:ring-4 focus:ring-[#4cd7f6]/10 rounded-xl py-3.5 pl-12 pr-4 text-[#dae2fd] placeholder:text-[#869397]/50 transition-all font-mono-tech text-sm outline-none"
                  id="email"
                  type="email"
                  placeholder="administrator@network.local"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Input Group: Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold uppercase tracking-widest text-[#4cd7f6]/70" htmlFor="password">
                  Access Key
                </label>
                <span className="text-[10px] uppercase font-bold text-[#4ae176] tracking-tighter cursor-pointer hover:text-[#4ae176]/80 transition-colors">
                  Request Recovery
                </span>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-[18px] w-[18px] text-[#869397] group-focus-within:text-[#4cd7f6] transition-colors" />
                </div>
                <input
                  className="w-full bg-[#2d3449]/50 border border-transparent focus:border-[#4cd7f6]/50 focus:ring-4 focus:ring-[#4cd7f6]/10 rounded-xl py-3.5 pl-12 pr-4 text-[#dae2fd] placeholder:text-[#869397]/50 transition-all font-mono-tech text-sm outline-none"
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              className="w-full group relative overflow-hidden bg-gradient-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold py-4 rounded-xl shadow-lg shadow-[#4cd7f6]/20 hover:shadow-[#4cd7f6]/40 transition-all active:scale-[0.98] disabled:opacity-70"
              type="submit"
              disabled={isLoading}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <LogIn className="h-5 w-5" />
                  </>
                )}
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[10px] font-bold text-[#869397]/40 uppercase tracking-[0.2em]">Secure Session</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            {/* Secondary Link */}
            <p className="text-center text-sm text-[#bcc9cd]">
              Need infrastructure access?{" "}
              <Link href="/register" className="text-[#4cd7f6] font-bold hover:underline decoration-[#4cd7f6]/30 underline-offset-4">
                Register Router
              </Link>
            </p>
          </form>
        </div>

        {/* AI Status Indicator Footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-[#869397]/60">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#4ae176] rounded-full animate-pulse shadow-[0_0_8px_rgba(74,225,118,0.8)]" />
            <span>AI Core Online</span>
          </div>
          <div className="w-1 h-1 bg-white/10 rounded-full" />
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            <span>v2.4.0 Encrypted</span>
          </div>
        </div>
      </main>

      {/* Illustrative Detail */}
      <div className="fixed bottom-0 right-0 p-12 opacity-10 hidden xl:block">
        <Router className="h-80 w-80 text-[#4cd7f6]" />
      </div>
    </div>
  )
}
