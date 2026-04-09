"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { UserTable } from "@/components/user-table"
import { useAuth } from "@/hooks/use-auth"

export default function UsersPage() {
  const { isAdmin, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push("/dashboard")
    }
  }, [isLoading, isAdmin, router])

  if (isLoading || !isAdmin) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage user accounts, permissions, and bot configurations.
        </p>
      </div>
      <UserTable />
    </div>
  )
}
