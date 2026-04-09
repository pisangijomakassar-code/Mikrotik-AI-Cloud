"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bot,
  Settings2,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"

export default function SettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/dashboard")
    }
  }, [authLoading, isAdmin, router])

  async function handleSync() {
    setIsSyncing(true)
    try {
      const res = await fetch("/api/provisioning", { method: "POST" })
      if (!res.ok) throw new Error("Sync failed")
      toast.success("Agent synced and restarted successfully")
    } catch {
      toast.error("Failed to sync agent. Check server logs.")
    } finally {
      setIsSyncing(false)
    }
  }

  if (authLoading || !isAdmin) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure system settings and manage the AI agent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LLM Configuration */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">LLM Configuration</CardTitle>
            </div>
            <CardDescription>
              Current language model settings for the AI agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Model</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  gemini-2.5-flash-lite
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Provider</span>
                <span className="text-sm text-foreground">OpenRouter</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400"
                >
                  Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">System Settings</CardTitle>
            </div>
            <CardDescription>
              Core system configuration and defaults.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Default Bot Token
                </span>
                <Badge variant="secondary" className="font-mono text-xs">
                  Configured
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  System Prompt
                </span>
                <span className="text-xs text-muted-foreground">
                  Custom prompt active
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  User Provisioning
                </span>
                <span className="text-sm text-foreground">Manual</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provisioning */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Agent Provisioning</CardTitle>
          </div>
          <CardDescription>
            Sync configuration changes and restart the AI agent service.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Sync & Restart Agent
              </p>
              <p className="text-xs text-muted-foreground">
                Apply all pending configuration changes and restart the agent
                container.
              </p>
            </div>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync & Restart
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20 bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <CardTitle className="text-base text-red-400">
              Danger Zone
            </CardTitle>
          </div>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Clear All Logs
              </p>
              <p className="text-xs text-muted-foreground">
                Permanently delete all activity logs from the database.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to delete all logs? This cannot be undone."
                  )
                ) {
                  toast.info("Log clearing not yet implemented")
                }
              }}
            >
              Clear Logs
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Reset System
              </p>
              <p className="text-xs text-muted-foreground">
                Reset all settings to default values.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to reset all settings? This cannot be undone."
                  )
                ) {
                  toast.info("System reset not yet implemented")
                }
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
