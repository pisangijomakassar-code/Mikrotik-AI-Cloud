import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import * as net from "net"
import * as tls from "tls"
import * as crypto from "crypto"

// ── MikroTik API Protocol Encoding ───────────────────────────────────────────

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len])
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xff])
  if (len < 0x200000) return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff])
  return Buffer.from([(len >> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff])
}

function encodeWord(word: string): Buffer {
  const wordBuf = Buffer.from(word, "utf8")
  return Buffer.concat([encodeLength(wordBuf.length), wordBuf])
}

function encodeSentence(words: string[]): Buffer {
  return Buffer.concat([...words.map(encodeWord), Buffer.from([0])])
}

function decodeResponse(data: Buffer): string[][] {
  const sentences: string[][] = []
  let current: string[] = []
  let i = 0
  while (i < data.length) {
    if (i >= data.length) break
    const b = data[i]
    let len = 0
    if (b < 0x80) { len = b; i++ }
    else if (b < 0xc0) { if (i + 1 >= data.length) break; len = ((b & 0x3f) << 8) | data[i + 1]; i += 2 }
    else if (b < 0xe0) { if (i + 2 >= data.length) break; len = ((b & 0x1f) << 16) | (data[i + 1] << 8) | data[i + 2]; i += 3 }
    else { if (i + 3 >= data.length) break; len = ((b & 0x0f) << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]; i += 4 }
    if (len === 0) {
      if (current.length > 0) { sentences.push(current); current = [] }
    } else {
      if (i + len > data.length) break
      current.push(data.slice(i, i + len).toString("utf8"))
      i += len
    }
  }
  return sentences
}

// ── MikroTik Login via plain TCP ─────────────────────────────────────────────

function loginPlainTCP(host: string, port: number, username: string, password: string, timeoutMs = 8000): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false
    let buffer = Buffer.alloc(0)
    let phase: "new_method" | "old_method" = "new_method"

    const done = (success: boolean, message: string) => {
      if (!resolved) { resolved = true; socket.destroy(); resolve({ success, message }) }
    }

    socket.setTimeout(timeoutMs)
    socket.on("timeout", () => done(false, `Timeout — host tidak merespons dalam ${timeoutMs / 1000} detik`))
    socket.on("error", (err) => done(false, `Koneksi TCP gagal: ${err.message}`))

    socket.on("connect", () => {
      // MikroTik API: client sends first, no banner from server
      socket.write(encodeSentence(["/login", `=name=${username}`, `=password=${password}`]))
    })

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      const sentences = decodeResponse(buffer)

      for (const sentence of sentences) {
        if (!sentence[0]) continue

        if (sentence[0] === "!done") {
          const retAttr = sentence.find(w => w.startsWith("=ret="))
          if (retAttr && phase === "new_method") {
            // Old RouterOS — needs MD5 challenge
            phase = "old_method"
            const challenge = retAttr.replace("=ret=", "")
            const challengeBuf = Buffer.from(challenge, "hex")
            const md5 = crypto.createHash("md5")
            md5.update(Buffer.from([0]))
            md5.update(Buffer.from(password, "utf8"))
            md5.update(challengeBuf)
            const hash = md5.digest("hex")
            buffer = Buffer.alloc(0)
            socket.write(encodeSentence(["/login", `=name=${username}`, `=response=00${hash}`]))
          } else {
            done(true, `✓ Login berhasil sebagai "${username}"`)
          }
          return
        }

        if (sentence[0] === "!trap") {
          const msg = sentence.find(w => w.startsWith("=message="))?.replace("=message=", "") ?? "Username/password salah"
          done(false, `Login ditolak: ${msg}`)
          return
        }
      }
    })

    socket.connect(port, host)
  })
}

// ── MikroTik Login via TLS ────────────────────────────────────────────────────

function loginTLS(host: string, port: number, username: string, password: string, timeoutMs = 8000): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    let resolved = false
    let buffer = Buffer.alloc(0)
    let phase: "new_method" | "old_method" = "new_method"

    const done = (success: boolean, message: string) => {
      if (!resolved) { resolved = true; socket.destroy(); resolve({ success, message }) }
    }

    const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
      socket.write(encodeSentence(["/login", `=name=${username}`, `=password=${password}`]))
    })

    socket.setTimeout(timeoutMs)
    socket.on("timeout", () => done(false, `Timeout TLS`))
    socket.on("error", (err) => done(false, `TLS gagal: ${err.message}`))

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      const sentences = decodeResponse(buffer)
      for (const sentence of sentences) {
        if (!sentence[0]) continue
        if (sentence[0] === "!done") {
          const retAttr = sentence.find(w => w.startsWith("=ret="))
          if (retAttr && phase === "new_method") {
            phase = "old_method"
            const challenge = retAttr.replace("=ret=", "")
            const challengeBuf = Buffer.from(challenge, "hex")
            const md5 = crypto.createHash("md5")
            md5.update(Buffer.from([0]))
            md5.update(Buffer.from(password, "utf8"))
            md5.update(challengeBuf)
            buffer = Buffer.alloc(0)
            socket.write(encodeSentence(["/login", `=name=${username}`, `=response=00${md5.digest("hex")}`]))
          } else {
            done(true, `✓ Login berhasil via TLS sebagai "${username}"`)
          }
          return
        }
        if (sentence[0] === "!trap") {
          const msg = sentence.find(w => w.startsWith("=message="))?.replace("=message=", "") ?? "Username/password salah"
          done(false, `Login ditolak (TLS): ${msg}`)
          return
        }
      }
    })
  })
}

// ── API Route ─────────────────────────────────────────────────────────────────

/** Parse "host:port" string — returns clean hostname and resolved port */
function parseHostPort(rawHost: string, rawPort: string): { host: string; port: string } {
  const trimmed = rawHost.trim()
  const lastColon = trimmed.lastIndexOf(":")
  if (lastColon !== -1) {
    const potentialPort = trimmed.slice(lastColon + 1)
    const portNum = parseInt(potentialPort, 10)
    if (potentialPort && !isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
      return { host: trimmed.slice(0, lastColon), port: potentialPort }
    }
  }
  return { host: trimmed, port: rawPort }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const raw = body as { host?: string; port?: string; username?: string; password?: string }

    if (!raw.host || !raw.port) {
      return Response.json({ error: "Host dan port wajib diisi" }, { status: 400 })
    }

    const { host, port } = parseHostPort(raw.host, raw.port)
    const { username, password } = raw

    // No credentials — TCP only
    if (!username || !password) {
      const tcpResult = await new Promise<{ success: boolean; message: string }>((resolve) => {
        const s = new net.Socket()
        s.setTimeout(5000)
        s.on("connect", () => { s.destroy(); resolve({ success: true, message: `Port ${port} terbuka ✓ (isi username & password untuk test login)` }) })
        s.on("timeout", () => { s.destroy(); resolve({ success: false, message: "Timeout: host tidak merespons" }) })
        s.on("error", (e) => resolve({ success: false, message: `Tidak bisa terhubung: ${e.message}` }))
        s.connect(parseInt(port), host)
      })
      return Response.json(tcpResult)
    }

    // Try plain TCP first
    const tcpResult = await loginPlainTCP(host, parseInt(port), username, password)
    if (tcpResult.success) return Response.json(tcpResult)

    // If TCP fails, try TLS
    const tlsResult = await loginTLS(host, parseInt(port), username, password)
    if (tlsResult.success) return Response.json(tlsResult)

    // Both failed — return TCP error (more relevant)
    return Response.json({ success: false, message: tcpResult.message })

  } catch (error) {
    return Response.json({ success: false, message: `Error: ${error instanceof Error ? error.message : "Unknown"}` })
  }
}
