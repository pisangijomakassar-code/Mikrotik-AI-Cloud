// Simple in-memory rate limiter — works for single-process VPS (not serverless/Edge).
// Key = identifier (IP or email), window = 15 min, max = 10 attempts.

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 10

// Returns true if the request is allowed, false if rate-limited.
export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const bucket = store.get(key)
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (bucket.count >= MAX_ATTEMPTS) return false
  bucket.count++
  return true
}

// Reset counter on successful login.
export function resetRateLimit(key: string): void {
  store.delete(key)
}

// Evict stale entries periodically to avoid unbounded growth.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)
