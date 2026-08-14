"use client"

import { useEffect } from "react"

import { API_MODE, IS_MOCKED } from "@/services/http"
import { ls } from "@/lib/local-storage"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { useAuthStore } from "@/stores/auth.store"

/**
 * Tell the platform this person is here.
 *
 * auth-profile-service has had the whole mechanism from the start — a WebSocket at
 * `/ws/presence`, a Redis key with a 30-second TTL, and `profile.online` read live from
 * it — and nothing ever opened the socket. So every profile rendered its dot grey and
 * said "Away", including yours, including while you were looking at it.
 *
 * A heartbeat every 10 seconds against a 30-second TTL: two may be lost to a slow
 * network before anyone is called away, and a closed tab is offline within thirty
 * seconds without needing to announce it. That is also the server's own expectation —
 * it waits `PRESENCE_TTL_SECONDS` for a frame and hangs up if none arrives.
 *
 * Reconnects with a backoff that stops growing at half a minute. A phone that has been
 * asleep for an hour comes back online at the next tick rather than at the end of a
 * doubling sequence nobody was awake for.
 */
const HEARTBEAT_MS = 10_000
const FIRST_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

/** `https://…` → `wss://…`, and the same for the insecure pair. */
function presenceUrl(token: string): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) return null
  try {
    const url = new URL("/auth/ws/presence", base)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.searchParams.set("token", token)
    return url.toString()
  } catch {
    return null
  }
}

export function usePresence(): void {
  const userId = useAuthStore((state) => state.userId)

  useEffect(() => {
    // Nobody signed in, or no backend to tell. The mock has no socket and inventing
    // one would make this look wired when it is not — the exact failure being fixed.
    if (!userId || IS_MOCKED) return

    let socket: WebSocket | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let delay = FIRST_RETRY_MS
    let stopped = false

    const open = () => {
      if (stopped) return
      const token = ls.get<string | null>(STORAGE_KEYS.accessToken, null)
      if (!token) return

      const url = presenceUrl(token)
      if (!url) return

      socket = new WebSocket(url)

      socket.onopen = () => {
        delay = FIRST_RETRY_MS
        heartbeat = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send("♥")
        }, HEARTBEAT_MS)
      }

      socket.onclose = (event) => {
        if (heartbeat) clearInterval(heartbeat)
        heartbeat = null
        // 4401 is the server refusing the token. Retrying cannot fix that and would
        // hammer it once a second until the tab is closed; the session will be
        // refreshed or ended elsewhere, and this effect re-runs when it is.
        if (stopped || event.code === 4401) return
        retry = setTimeout(open, delay)
        delay = Math.min(delay * 2, MAX_RETRY_MS)
      }
    }

    open()

    return () => {
      stopped = true
      if (heartbeat) clearInterval(heartbeat)
      if (retry) clearTimeout(retry)
      // Closing on the way out is what makes signing out and closing a tab immediate
      // rather than something the TTL notices half a minute later.
      socket?.close()
    }
  }, [userId])
}

/** Whether presence can work at all here — the mock has no socket to open. */
export const PRESENCE_AVAILABLE = API_MODE === "live"
