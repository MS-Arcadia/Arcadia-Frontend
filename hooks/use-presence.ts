"use client"

import { useEffect } from "react"

import { API_MODE, IS_MOCKED } from "@/services/http"
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

/**
 * `https://…` → `wss://…`, and the same for the insecure pair.
 *
 * No token in it. A browser cannot set headers on a WebSocket handshake, so the usual
 * trick is `?token=`, and the cost is a live access token in every access log that
 * records a request line — which on this platform means Loki, readable by anyone with a
 * Grafana login. It goes in the first frame instead.
 */
function presenceUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) return null
  try {
    const url = new URL("/auth/ws/presence", base)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    return url.toString()
  } catch {
    return null
  }
}

export function usePresence(): void {
  const userId = useAuthStore((state) => state.userId)
  const accessToken = useAuthStore((state) => state.accessToken)

  useEffect(() => {
    // Nobody signed in, or no backend to tell. The mock has no socket and inventing
    // one would make this look wired when it is not — the exact failure being fixed.
    if (!userId || !accessToken || IS_MOCKED) return

    let socket: WebSocket | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let delay = FIRST_RETRY_MS
    let stopped = false

    const open = () => {
      if (stopped) return
      if (!accessToken) return

      const url = presenceUrl()
      if (!url) return

      socket = new WebSocket(url)

      socket.onopen = () => {
        delay = FIRST_RETRY_MS
        // The token first, before anything else: the server accepts the socket, waits
        // five seconds for this one frame, and hangs up on 4401 if it is not a usable
        // token. Every frame after it is a heartbeat.
        socket?.send(accessToken)
        heartbeat = setInterval(() => {
          // ASCII on purpose. A heart character is three UTF-8 bytes; proxies
          // and DevTools that assume Latin-1 render it as `â™¥`, which looked
          // like a broken server frame rather than a heartbeat.
          if (socket?.readyState === WebSocket.OPEN) socket.send("ping")
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
  }, [userId, accessToken])
}

/** Whether presence can work at all here — the mock has no socket to open. */
export const PRESENCE_AVAILABLE = API_MODE === "live"
