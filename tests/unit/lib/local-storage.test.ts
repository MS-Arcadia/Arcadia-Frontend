import { describe, expect, it, vi } from "vitest"

import { ls } from "@/lib/local-storage"
import {
  clearSession,
  onSessionChange,
  readAccessToken,
  readRefreshToken,
  saveSession,
} from "@/lib/session"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import type { TokenPair } from "@/types/auth.api.type"

describe("ls", () => {
  it("round-trips a value through JSON", () => {
    ls.set(STORAGE_KEYS.auth, { a: 1 })
    expect(ls.get(STORAGE_KEYS.auth, null)).toEqual({ a: 1 })
  })

  it("returns the fallback for a key that was never written", () => {
    expect(ls.get("arcadia.store-view", "fallback")).toBe("fallback")
  })

  it("returns the fallback when the stored JSON is corrupt", () => {
    window.localStorage.setItem(STORAGE_KEYS.auth, "{not json")
    expect(ls.get(STORAGE_KEYS.auth, { ok: true })).toEqual({ ok: true })
  })

  it("remove deletes the key", () => {
    ls.set(STORAGE_KEYS.auth, 1)
    ls.remove(STORAGE_KEYS.auth)
    expect(ls.get(STORAGE_KEYS.auth, "gone")).toBe("gone")
  })

  it("never throws when the browser forbids storage — a component reading it directly would crash for those users", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota full", "QuotaExceededError")
      })
    expect(() => ls.set(STORAGE_KEYS.auth, "x")).not.toThrow()
    spy.mockRestore()
  })

  it("a JSON stringification of null still reads back as null, not the fallback", () => {
    ls.set(STORAGE_KEYS.accessToken, null)
    expect(ls.get<string | null>(STORAGE_KEYS.accessToken, "fallback")).toBeNull()
  })
})

describe("storage keys", () => {
  it("are namespaced under arcadia.* so a rename is one edit and a collision is visible", () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith("arcadia.")).toBe(true)
    }
  })
})

const TOKENS: TokenPair = {
  access_token: "mock.u1.access",
  refresh_token: "mock.u1.refresh",
  token_type: "bearer",
}

describe("session", () => {
  it("saves and reads back both tokens", () => {
    saveSession(TOKENS)
    expect(readAccessToken()).toBe("mock.u1.access")
    expect(readRefreshToken()).toBe("mock.u1.refresh")
  })

  it("notifies listeners on save and on clear, and unsubscribe stops the calls", () => {
    const listener = vi.fn()
    const stop = onSessionChange(listener)

    saveSession(TOKENS)
    expect(listener).toHaveBeenLastCalledWith(TOKENS)

    clearSession()
    expect(listener).toHaveBeenLastCalledWith(null)
    expect(listener).toHaveBeenCalledTimes(2)

    stop()
    saveSession(TOKENS)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("clearSession removes both tokens", () => {
    saveSession(TOKENS)
    clearSession()
    expect(readAccessToken()).toBeNull()
    expect(readRefreshToken()).toBeNull()
  })
})
