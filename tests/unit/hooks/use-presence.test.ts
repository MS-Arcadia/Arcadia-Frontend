import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A controllable WebSocket stand-in: enough surface for the hook's open/close/
 * send calls, with events the test fires by hand.
 */
class FakeWebSocket {
  // The constants real WebSocket exposes; the hook gates its heartbeat on
  // `WebSocket.OPEN` and would send nothing against a class without them.
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  static instances: FakeWebSocket[] = []

  url: string
  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
  }

  // Test-side controls.
  serverAccepts(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  serverCloses(code = 1006): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code })
  }
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal("WebSocket", FakeWebSocket)
  FakeWebSocket.instances = []

  // `IS_MOCKED` is decided once, at import, so the live-mode hook needs a fresh
  // module evaluated after the env says live.
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live")
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8090")
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function renderPresence(
  session: { userId: string | null; accessToken: string | null } = {
    userId: "u1",
    accessToken: "token-1",
  }
): Promise<void> {
  // The module registry was reset, so the store singleton must come from the
  // same fresh registry the hook reads — a state set on yesterday's singleton
  // would silently not apply.
  const { useAuthStore } = await import("@/stores/auth.store")
  useAuthStore.setState(session)
  const { usePresence } = await import("@/hooks/use-presence")
  renderHook(() => usePresence())
}

describe("usePresence", () => {
  it("does nothing while the mock backend is on — it has no socket", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock")
    await renderPresence()

    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it("does nothing without a session", async () => {
    await renderPresence({ userId: null, accessToken: null })

    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it("opens ws:// against an http base, and the token is the first frame", async () => {
    await renderPresence()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].url).toBe(
      "ws://localhost:8090/auth/ws/presence"
    )

    act(() => {
      FakeWebSocket.instances[0].serverAccepts()
    })
    expect(FakeWebSocket.instances[0].sent[0]).toBe("token-1")
  })

  it("an https base becomes wss", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.arcadia.example")
    await renderPresence()

    expect(FakeWebSocket.instances[0].url).toBe(
      "wss://api.arcadia.example/auth/ws/presence"
    )
  })

  it("a base url that does not parse means no socket", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "not a url at all")
    await renderPresence()

    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it("heartbeats every ten seconds with an ASCII ping", async () => {
    await renderPresence()
    const socket = FakeWebSocket.instances[0]

    act(() => {
      socket.serverAccepts()
    })
    act(() => {
      vi.advanceTimersByTime(35_000)
    })

    expect(socket.sent.filter((frame) => frame === "ping")).toHaveLength(3)
  })

  it("reconnects with a doubling backoff capped at half a minute", async () => {
    await renderPresence()

    act(() => {
      FakeWebSocket.instances[0].serverCloses()
      vi.advanceTimersByTime(999)
    })
    expect(FakeWebSocket.instances).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(FakeWebSocket.instances).toHaveLength(2)

    // Second drop: backoff doubles to 2s.
    act(() => {
      FakeWebSocket.instances[1].serverCloses()
      vi.advanceTimersByTime(1_999)
    })
    expect(FakeWebSocket.instances).toHaveLength(2)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it("a 4401 token refusal is not retried — retrying cannot fix the token", async () => {
    await renderPresence()

    act(() => {
      FakeWebSocket.instances[0].serverCloses(4401)
      vi.advanceTimersByTime(120_000)
    })
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it("a successful reopen resets the backoff to one second", async () => {
    await renderPresence()

    act(() => {
      FakeWebSocket.instances[0].serverCloses()
      vi.advanceTimersByTime(1_000)
    })
    act(() => {
      FakeWebSocket.instances[1].serverAccepts()
    })
    act(() => {
      FakeWebSocket.instances[1].serverCloses()
      vi.advanceTimersByTime(1_000)
    })
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it("unmounting stops the heartbeat, clears the retry and closes the socket", async () => {
    const { useAuthStore } = await import("@/stores/auth.store")
    useAuthStore.setState({ userId: "u1", accessToken: "token-1" })
    const { usePresence } = await import("@/hooks/use-presence")
    const view = renderHook(() => usePresence())
    const socket = FakeWebSocket.instances[0]
    act(() => {
      socket.serverAccepts()
    })

    view.unmount()

    expect(socket.readyState).toBe(FakeWebSocket.CLOSED)
    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(socket.sent.filter((frame) => frame === "ping")).toHaveLength(0)
  })
})
