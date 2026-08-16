import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { authKeys } from "@/api/auth"
import { readAccessToken, readRefreshToken } from "@/lib/session"
import { useAuthStore } from "@/stores/auth.store"
import type { PublicProfile, TokenPair } from "@/types/auth.api.type"

const routerReplace = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
}))

vi.mock("@/api/auth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getProfile: vi.fn(),
}))

import { getProfile, login, logout, register } from "@/api/auth"
import {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useRegisterMutation,
} from "@/queries/auth"

import { renderHookWithQuery } from "../../helpers/query"
import { fakeJwt } from "../../helpers/tokens"

const USER_ID = "11111111-1111-4111-8111-111111111111"

const TOKENS: TokenPair = {
  access_token: fakeJwt({ sub: USER_ID, role: "BASIC_USER" }),
  refresh_token: "mock.u1.refresh",
  token_type: "bearer",
}

const PROFILE = {
  user_id: USER_ID,
  display_name: "Sam Player",
  email: "player@arcadia.local",
  bio: "",
  avatar_url: "",
  public_library: [],
  market_holdings: [],
  top_posts: [],
  created_at: "2026-01-01T00:00:00Z",
} as unknown as PublicProfile

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  useAuthStore.setState(useAuthStore.getInitialState())
})

describe("useLoginMutation", () => {
  it("signs the store in, wipes the previous session's cache and moves to the store", async () => {
    vi.mocked(login).mockResolvedValue(TOKENS)
    const { client, result } = renderHookWithQuery(() => useLoginMutation())

    // A stale entry from somebody else's session.
    client.setQueryData(authKeys.directory(), [{ user_id: "someone-else" }])

    await act(async () => {
      await result.current.mutateAsync({
        email: "player@arcadia.local",
        password: "player-password",
      })
    })

    expect(useAuthStore.getState().accessToken).toBe(TOKENS.access_token)
    expect(useAuthStore.getState().userId).toBe(USER_ID)
    expect(readAccessToken()).toBe(TOKENS.access_token)
    expect(routerReplace).toHaveBeenCalledWith("/store")
    expect(client.getQueryData(authKeys.directory())).toBeUndefined()
  })

  it("a refused sign-in leaves the store untouched", async () => {
    vi.mocked(login).mockRejectedValue(new Error("401"))
    const { result } = renderHookWithQuery(() => useLoginMutation())

    await expect(
      act(async () =>
        result.current.mutateAsync({ email: "x@y.z", password: "wrong" })
      )
    ).rejects.toBeTruthy()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(routerReplace).not.toHaveBeenCalled()
  })
})

describe("useRegisterMutation", () => {
  it("registers, then signs in with the login that follows it", async () => {
    vi.mocked(register).mockResolvedValue({} as never)
    vi.mocked(login).mockResolvedValue(TOKENS)
    const { result } = renderHookWithQuery(() => useRegisterMutation())

    await act(async () => {
      await result.current.mutateAsync({
        display_name: "Sam Player",
        email: "player@arcadia.local",
        password: "player-password",
        confirm: "player-password",
      })
    })

    expect(register).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith({
      email: "player@arcadia.local",
      password: "player-password",
    })
    expect(useAuthStore.getState().userId).toBe(USER_ID)
    expect(routerReplace).toHaveBeenCalledWith("/store")
  })
})

describe("useLogoutMutation", () => {
  it("tells the server, then clears local state even when the server refuses", async () => {
    useAuthStore.getState().signIn(TOKENS)
    vi.mocked(logout).mockRejectedValue(new Error("network down"))
    const { result } = renderHookWithQuery(() => useLogoutMutation())

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(logout).toHaveBeenCalledWith(TOKENS.refresh_token)
    expect(useAuthStore.getState().userId).toBeNull()
    expect(readAccessToken()).toBeNull()
    expect(readRefreshToken()).toBeNull()
    expect(routerReplace).toHaveBeenCalledWith("/sign-in")
  })
})

describe("useMeQuery", () => {
  it("stays idle without a session — it must not fire on the sign-in page", () => {
    const { result } = renderHookWithQuery(() => useMeQuery())

    expect(result.current.isFetching).toBe(false)
    expect(getProfile).not.toHaveBeenCalled()
  })

  it("builds the session identity from the profile and the token's role claim", async () => {
    useAuthStore.setState({
      userId: USER_ID,
      accessToken: fakeJwt({ sub: USER_ID, role: "DEVELOPER" }),
    })
    vi.mocked(getProfile).mockResolvedValue(PROFILE)

    const { result } = renderHookWithQuery(() => useMeQuery())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      user_id: USER_ID,
      role: "DEVELOPER",
    })
    // The store's profile is filled as a side effect, for useHasRole.
    expect(useAuthStore.getState().user?.role).toBe("DEVELOPER")
  })
})
