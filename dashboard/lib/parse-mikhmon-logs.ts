// Helpers untuk parse log RouterOS jadi format Mikhmon-style:
//   - Hotspot Log: Time | User (IP) | Message
//   - User Log: Time | User (IP) | Action
//
// Source data: array {time, topics, message} dari `/api/routers/logs`.

export interface HotspotLogRow {
  time: string
  user: string
  ip: string
  message: string
  raw: string
}

export interface UserLogRow {
  time: string
  user: string
  ip: string
  action: string
  raw: string
}

interface RawLog { time: string; topics: string; message: string }

// Hotspot log entries — topics include "hotspot" atau message match pattern
// hotspot user. Contoh format MikroTik:
//   "user xxx logged in"
//   "user xxx logged in (mac=AA:..)"
//   "user xxx logged out (lease-expired|user-logout|keepalive timeout)"
//   "user xxx login failed: invalid username or password"
//   "xxx (192.168.1.5): logged in"
//   "xxx (192.168.1.5): logged out: keepalive timeout"
//   "xxx (192.168.1.5): login by mac-cookie"
export function parseHotspotLogs(logs: RawLog[]): HotspotLogRow[] {
  const out: HotspotLogRow[] = []
  for (const l of logs) {
    if (!l.topics?.toLowerCase().includes("hotspot")) continue

    const msg = l.message
    // Pattern A: "username (ip): action"
    let m = msg.match(/^([^\s(]+)\s*\(([^)]+)\):\s*(.+)$/)
    if (m) {
      out.push({
        time: l.time,
        user: m[1],
        ip: m[2],
        message: m[3].trim(),
        raw: msg,
      })
      continue
    }
    // Pattern B: "user XXX logged in/out (...)"
    m = msg.match(/^user\s+["']?([^"'\s]+)["']?\s+(logged\s+(?:in|out).*)$/i)
    if (m) {
      out.push({
        time: l.time,
        user: m[1],
        ip: "",
        message: m[2],
        raw: msg,
      })
      continue
    }
    // Pattern C: "XXX login failed: ..."
    m = msg.match(/^["']?([^"'\s,:]+)["']?[:\s].*login\s+failed(?::\s*(.+))?$/i)
    if (m) {
      out.push({
        time: l.time,
        user: m[1],
        ip: "",
        message: `login failed${m[2] ? ": " + m[2].trim() : ""}`,
        raw: msg,
      })
      continue
    }
    // Fallback: tampilkan apa adanya, user kosong
    out.push({ time: l.time, user: "", ip: "", message: msg, raw: msg })
  }
  return out
}

// User Log entries — system/admin actions: login, logout, config change.
// Topics include "system" / "info" / "account" / "critical" tapi BUKAN hotspot.
// Contoh format:
//   "user admin logged in via ssh from 1.2.3.4"
//   "user admin logged out via api"
//   "system,info,account user admin policy changed"
//   "system,error,critical login failure for user admin from 1.2.3.4"
export function parseUserLogs(logs: RawLog[]): UserLogRow[] {
  const out: UserLogRow[] = []
  for (const l of logs) {
    const t = l.topics?.toLowerCase() ?? ""
    // Filter: TIDAK include hotspot. Wajib include account/system/info.
    if (t.includes("hotspot")) continue
    if (!t.includes("account") && !t.includes("system") && !t.includes("info")) continue

    const msg = l.message
    let user = ""
    let ip = ""
    let action = msg

    // Pattern: "user XXX logged in via SSH from 1.2.3.4"
    let m = msg.match(/user\s+["']?([^"'\s]+)["']?\s+(logged\s+(?:in|out)[^,]*?)(?:\s+from\s+([0-9a-f.:]+))?\s*$/i)
    if (m) {
      user = m[1]
      action = m[2]
      ip = m[3] ?? ""
    } else {
      // Pattern: "login failure for user admin from 1.2.3.4"
      m = msg.match(/login\s+failure\s+for\s+user\s+["']?([^"'\s]+)["']?(?:\s+from\s+([0-9a-f.:]+))?/i)
      if (m) {
        user = m[1]
        ip = m[2] ?? ""
        action = "login failure"
      }
    }

    out.push({ time: l.time, user, ip, action, raw: msg })
  }
  return out
}
