"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { TopNavBar } from "@/components/top-navbar"
import { SidebarProvider } from "@/components/sidebar-context"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    // Strict separation: SUPER_ADMIN tidak boleh akses dashboard tenant.
    // Redirect ke platform console — UI mereka sendiri.
    if (user?.role === "SUPER_ADMIN") {
      router.push("/platform/dashboard")
    }
  }, [isLoading, isAuthenticated, user?.role, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user?.role === "SUPER_ADMIN") {
    return null
  }

  return (
    <SidebarProvider>
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <TopNavBar />
      <main className="lg:ml-64 p-4 lg:p-8 min-h-screen">
        {children}
      </main>
    </div>
    </SidebarProvider>
  )
}
