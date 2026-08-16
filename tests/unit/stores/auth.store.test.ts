import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { clearSession, readAccessToken, saveSession } from "@/lib/session"
import { useAuthStore, useHasRole } from "@/stores/auth.store"
import type { TokenPair, UserSummary } from "@/types/auth.api.type"

const TOKENS: TokenPair = {
  access_token: "mock.11111111-1111-4111-8111-111111111111.access",
  refresh_token: "mock.11111111-1111-4111-8111-111111111111.refresh",
  token_type: "bearer",
}

const USER: UserSummary = {
  user_id: "11111111-1111-4111-8111-111111111111",
  display_name: "Sam Player",
  email: "player@arcadia.local",
  role: "BASIC_USER",
  state: "ACTIVE",
}

beforeEach(() => {
  // Zustand stores are module singletons; each test starts from the signed-out
  // state rather than from whatever the previous one left behind.
  useAuthStore.setState({ ...useAuthStore.getInitialState(), user: null })
})

describe("useAuthStore", () => {
  it("signIn derives the user id from the token's subject", () => {
    act(() => useAuthStore.getState().signIn(TOKENS))

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe(TOKENS.access_token)
    expect(state.refreshToken).toBe(TOKENS.refresh_token)
    expect(state.userId).toBe("11111111-1111-4111-8111-111111111111")
  })

  it("signIn also writes the session both http.ts and a reload read back", () => {
    act(() => useAuthStore.getState().signIn(TOKENS))
    expect(readAccessToken()).toBe(TOKENS.access_token)
  })

  it("setUser fills the profile without touching the tokens", () => {
    act(() => {
      useAuthStore.getState().signIn(TOKENS)
      useAuthStore.getState().setUser(USER)
    })

    const state = useAuthStore.getState()
    expect(state.user).toEqual(USER)
    expect(state.accessToken).toBe(TOKENS.access_token)
  })

  it("signOut empties everything and clears the stored session", () => {
    act(() => {
      useAuthStore.getState().signIn(TOKENS)
      useAuthStore.getState().setUser(USER)
      useAuthStore.getState().signOut()
    })

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      userId: null,
      user: null,
    })
    expect(readAccessToken()).toBeNull()
  })

  it("a session change from outside (the interceptor refreshing) reaches the store", () => {
    act(() => useAuthStore.getState().signIn(TOKENS))

    const refreshed: TokenPair = {
      ...TOKENS,
      access_token: "mock.99999999-9999-4999-8999-999999999999.access",
      refresh_token: "mock.99999999-9999-4999-8999-999999999999.refresh",
    }
    act(() => saveSession(refreshed))
    expect(useAuthStore.getState().accessToken).toBe(refreshed.access_token)
    expect(useAuthStore.getState().userId).toBe(
      "99999999-9999-4999-8999-999999999999"
    )

    // And clearing from outside empties it again.
    act(() => clearSession())
    expect(useAuthStore.getState().userId).toBeNull()
  })
})

describe("useHasRole", () => {
  function hookWithRole(role: UserSummary["role"] | undefined) {
    useAuthStore.setState({ user: role ? { ...USER, role } : null })
    return renderHook(() => useHasRole("SUPPORT", "ADMIN"))
  }

  it("true when the viewer holds one of the roles", () => {
    expect(hookWithRole("SUPPORT").result.current).toBe(true)
    expect(hookWithRole("ADMIN").result.current).toBe(true)
  })

  it("false for another role, or no profile yet", () => {
    expect(hookWithRole("BASIC_USER").result.current).toBe(false)
    expect(hookWithRole(undefined).result.current).toBe(false)
  })
})
