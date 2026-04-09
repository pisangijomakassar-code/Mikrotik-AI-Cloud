"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Radio, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Redirect to dashboard if already logged in
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
    <div className="flex min-h-screen items-center justify-center px-4">
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
              Sign in to your account
            </p>
          </div>
        </div>

        <Card className="border-0 bg-[#171f33]/80 backdrop-blur-xl" style={{ boxShadow: '0 0 32px rgba(76,215,246,0.08)' }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="bg-[#222a3d] border-0 focus:ring-[#4cd7f6] focus:ring-1"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-[#222a3d] border-0 focus:ring-[#4cd7f6] focus:ring-1"
                  autoComplete="current-password"
                  required
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
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {"Don't have an account? "}
          <Link
            href="/register"
            className="font-medium text-primary hover:text-primary/80"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
