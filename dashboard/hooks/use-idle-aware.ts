"use client"

import { useEffect, useState } from "react"

/**
 * Track user idle state in browser. Returns `true` setelah `idleMs` tanpa
 * aktivitas (mouse, keyboard, scroll, touch). Reset ke `false` saat ada
 * aktivitas baru.
 *
 * Pakai untuk pause polling background saat user lupa tutup tab:
 *
 * ```ts
 * const isIdle = useIdleAware(30 * 60 * 1000)  // 30 menit
 * useQuery({
 *   refetchInterval: isIdle ? false : 30_000,
 *   refetchIntervalInBackground: false,  // tab background → pause juga
 * })
 * ```
 */
export function useIdleAware(idleMs = 30 * 60 * 1000): boolean {
  const [isIdle, setIsIdle] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    let timer: ReturnType<typeof setTimeout> | null = null
    const reset = () => {
      if (timer) clearTimeout(timer)
      if (isIdle) setIsIdle(false)
      timer = setTimeout(() => setIsIdle(true), idleMs)
    }

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ]
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      if (timer) clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [idleMs, isIdle])

  return isIdle
}
