// Helpers untuk parsing log hotspot RouterOS jadi event voucher
// (login/logout/gagal). Dipakai di LogTable + VoucherActivityFeed.

import { LogIn, LogOut, KeyRound, AlertTriangle, Shield, Wifi, Ticket, Info } from "lucide-react"
import type { ReactNode } from "react"

export interface ParsedHotspotLog {
  /** "login" | "logout" | "login-failed" | null kalau bukan event hotspot */
  kind: "login" | "logout" | "login-failed" | null
  username: string
  reason?: string
}

// Format yang teramati dari MikroTik:
//   "user xxx logged in"                                  → login
//   "logged in (mac=AA:BB:CC..)"                          → login
//   "user xxx logged out (lease-expired|user-logout|...)" → logout
//   "user xxx login failed: invalid username or password" → login-failed
//   "vc1234: login failed: ..."                           → login-failed
export function parseHotspotMessage(msg: string): ParsedHotspotLog {
  const lower = msg.toLowerCase()
  const failedMatch = msg.match(
    /(?:user\s+)?["']?([^"',:\s]+)["']?[:\s].*login\s+failed(?:[:\s]+(.+?))?$/i,
  )
  if (failedMatch) {
    return { kind: "login-failed", username: failedMatch[1], reason: failedMatch[2]?.trim() }
  }
  if (lower.includes("logged in") || lower.includes("login ok") || lower.includes("login")) {
    if (lower.includes("logged in") || lower.includes("login ok")) {
      const m = msg.match(/(?:user\s+)?["']?([^"',:\s]+)["']?\s+(?:->\s*)?logged in/i)
      return { kind: "login", username: m?.[1] ?? "" }
    }
  }
  if (lower.includes("logged out")) {
    const m = msg.match(/(?:user\s+)?["']?([^"',:\s]+)["']?\s+(?:->\s*)?logged out(?:\s*\(([^)]+)\))?/i)
    return { kind: "logout", username: m?.[1] ?? "", reason: m?.[2] }
  }
  return { kind: null, username: "" }
}

export function formatHotspotMessage(parsed: ParsedHotspotLog, original: string): string {
  if (parsed.kind === "login") return `voucher ${parsed.username} login`
  if (parsed.kind === "logout") {
    return parsed.reason
      ? `voucher ${parsed.username} logout (${parsed.reason})`
      : `voucher ${parsed.username} logout`
  }
  if (parsed.kind === "login-failed") {
    return parsed.reason
      ? `voucher ${parsed.username} gagal login: ${parsed.reason}`
      : `voucher ${parsed.username} gagal login`
  }
  return original
}

export function getTopicStyle(
  topics: string,
  parsed: ParsedHotspotLog,
): { icon: ReactNode; color: string; bg: string } {
  const make = (Icon: typeof LogIn, color: string, bg: string) => ({
    icon: <Icon className="h-3 w-3" />,
    color,
    bg,
  })
  if (parsed.kind === "login") return make(LogIn, "text-tertiary", "bg-[#4ae176]/10")
  if (parsed.kind === "logout") return make(LogOut, "text-muted-foreground", "bg-muted/40")
  if (parsed.kind === "login-failed") return make(KeyRound, "text-destructive", "bg-[#ffb4ab]/10")
  if (topics.includes("error") || topics.includes("critical"))
    return make(AlertTriangle, "text-destructive", "bg-[#ffb4ab]/10")
  if (topics.includes("warning")) return make(AlertTriangle, "text-amber-400", "bg-amber-400/10")
  if (topics.includes("firewall")) return make(Shield, "text-primary", "bg-primary/10")
  if (topics.includes("hotspot")) return make(Ticket, "text-primary", "bg-primary/10")
  if (topics.includes("wireless") || topics.includes("dhcp"))
    return make(Wifi, "text-tertiary", "bg-[#4ae176]/10")
  return make(Info, "text-muted-foreground", "bg-muted/40")
}
