import { AxiosError } from "axios"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { readAccessToken, saveSession } from "@/lib/session"
import { API } from "@/lib/api-paths"

// Keep the mock backend out of these tests: what is under test is the real
// interceptor stack, answering from a script rather than fixtures.
vi.mock("@/services/mocks/adapter", () => ({
  installMockAdapter: vi.fn(),
}))

import { toApiError, http } from "@/services/http"

import { useScriptedHttp, waitForCalls } from "../../helpers/http"
import { fakeJwt } from "../../helpers/tokens"

const PAIR = {
  access_token: fakeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }),
  refresh_token: "mock.u1.refresh",
  token_type: "bearer",
}

beforeEach(() => {
  window.localStorage.clear()
})

describe("toApiError", () => {
  it("a non-axios error is UNKNOWN", () => {
    expect(toApiError(new Error("boom"))).toEqual({
      status: 0,
      reason: "UNKNOWN",
      message: "Something went wrong.",
    })
  })

  it("an axios error with no response is NETWORK, or TIMEOUT when aborted", () => {
    expect(toApiError(new AxiosError("Network Error", undefined))).toMatchObject({
      status: 0,
      reason: "NETWORK",
    })
    expect(
      toApiError(new AxiosError("timeout", "ECONNABORTED"))
    ).toMatchObject({ status: 0, reason: "TIMEOUT" })
  })

  it("maps a known RFC 7807 reason to its message", () => {
    const error = new AxiosError("fail", undefined, undefined, undefined, {
      status: 409,
      statusText: "409",
      data: { reason: "INSUFFICIENT_FUNDS", detail: "for the logs" },
      headers: {},
      config: {} as never,
    })
    expect(toApiError(error)).toEqual({
      status: 409,
      reason: "INSUFFICIENT_FUNDS",
      message: "Your wallet balance is not enough.",
    })
  })

  it("an unknown reason falls back to the operator-facing detail, then to a generic line", () => {
    const withDetail = new AxiosError("fail", undefined, undefined, undefined, {
      status: 400,
      statusText: "400",
      data: { reason: "SOMETHING_NEW", detail: "Useful to a person" },
      headers: {},
      config: {} as never,
    })
    expect(toApiError(withDetail).message).toBe("Useful to a person")

    const bare = new AxiosError("fail", undefined, undefined, undefined, {
      status: 400,
      statusText: "400",
      data: {},
      headers: {},
      config: {} as never,
    })
    expect(toApiError(bare)).toEqual({
      status: 400,
      reason: "UNKNOWN",
      message: "The request did not go through.",
    })
  })

  it("carries the problem's field through for inline form errors", () => {
    const error = new AxiosError("fail", undefined, undefined, undefined, {
      status: 422,
      statusText: "422",
      data: { reason: "VALIDATION_FAILED", field: "email" },
      headers: {},
      config: {} as never,
    })
    expect(toApiError(error).field).toBe("email")
  })
})

describe("request interceptors", () => {
  it("attaches the stored access token as a bearer", async () => {
    const calls = useScriptedHttp()
    saveSession(PAIR)

    const pending = http.get("/catalog/v1/games")
    await waitForCalls(calls, 1)
    calls[0].respond({ data: [] })

    await expect(pending).resolves.toBeTruthy()
    expect(calls[0].request.headers.Authorization).toBe(
      `Bearer ${PAIR.access_token}`
    )
  })

  it("mints an Idempotency-Key on writes only — the services refuse money-moving calls without one", async () => {
    const calls = useScriptedHttp()

    const post = http.post(API.orders.place, { game_id: "g1" })
    await waitForCalls(calls, 1)
    calls[0].respond({ status: 202, data: {} })

    const put = http.put("/x", {})
    await waitForCalls(calls, 2)
    calls[1].respond({})

    const patch = http.patch("/x", {})
    await waitForCalls(calls, 3)
    calls[2].respond({})

    const del = http.delete("/x")
    await waitForCalls(calls, 4)
    calls[3].respond({})

    const get = http.get("/x")
    await waitForCalls(calls, 5)
    calls[4].respond({})

    await Promise.all([post, put, patch, del, get])

    for (const index of [0, 1, 2, 3]) {
      const key = calls[index].request.headers["Idempotency-Key"]
      expect(key, `call ${index}`).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    }
    expect(calls[4].request.headers["Idempotency-Key"]).toBeUndefined()

    // Each write minted its own key.
    const keys = [0, 1, 2, 3].map((index) => calls[index].request.headers["Idempotency-Key"])
    expect(new Set(keys).size).toBe(4)
  })

  it("an existing Idempotency-Key is kept, so a retry carries the same one", async () => {
    const calls = useScriptedHttp()

    const pending = http.post(
      "/wallet/v1/wallets/me/charges",
      { amount: 1 },
      { headers: { "Idempotency-Key": "caller-supplied" } }
    )
    await waitForCalls(calls, 1)
    calls[0].respond({})

    await pending
    expect(calls[0].request.headers["Idempotency-Key"]).toBe("caller-supplied")
  })

  it.each([
    ["login", API.auth.login],
    ["register", API.auth.register],
    ["refresh", API.auth.refresh],
    ["logout", API.auth.logout],
  ])(
    "credential exchange (%s) carries no Authorization — the gateway would 401 an expired token at the edge",
    async (_name, url) => {
      const calls = useScriptedHttp()
      saveSession(PAIR)

      const pending = http.post(url, {})
      await waitForCalls(calls, 1)
      calls[0].respond({})

      await pending
      expect(calls[0].request.headers.Authorization).toBeUndefined()
    }
  )
})

describe("token refresh", () => {
  function saveExpiringToken(offsetSeconds: number): string {
    const expiring = fakeJwt({
      sub: "u1",
      exp: Math.floor(Date.now() / 1000) + offsetSeconds,
    })
    saveSession({
      access_token: expiring,
      refresh_token: "mock.u1.refresh",
      token_type: "bearer",
    })
    return expiring
  }

  it("a token inside the one-minute skew is refreshed before the call goes out", async () => {
    const calls = useScriptedHttp()
    const expiring = saveExpiringToken(30)

    const pending = http.get("/catalog/v1/games")
    await waitForCalls(calls, 1)
    expect(calls[0].request.url.endsWith(API.auth.refresh)).toBe(true)

    calls[0].respond({ data: PAIR })
    await waitForCalls(calls, 2)
    calls[1].respond({ data: [] })

    await pending
    expect(calls[1].request.headers.Authorization).toBe(
      `Bearer ${PAIR.access_token}`
    )
    expect(calls[1].request.headers.Authorization).not.toBe(`Bearer ${expiring}`)
  })

  it("a healthy token is not refreshed", async () => {
    const calls = useScriptedHttp()
    saveExpiringToken(3600)

    const pending = http.get("/catalog/v1/games")
    await waitForCalls(calls, 1)
    calls[0].respond({ data: [] })

    await pending
    expect(calls[0].request.url.endsWith("/catalog/v1/games")).toBe(true)
  })

  it("a failed refresh clears the session and the original call still goes out", async () => {
    const calls = useScriptedHttp()
    saveExpiringToken(30)

    const pending = http.get("/catalog/v1/games")
    await waitForCalls(calls, 1)
    calls[0].reject({ status: 401, reason: "REFRESH_TOKEN_USED" })
    await waitForCalls(calls, 2)
    calls[1].respond({ data: [] })

    await pending
    expect(readAccessToken()).toBeNull()
  })

  it("one refresh is shared by every caller that noticed the dead token", async () => {
    const calls = useScriptedHttp()
    saveExpiringToken(30)

    const first = http.get("/catalog/v1/games")
    const second = http.get("/catalog/v1/library")

    await waitForCalls(calls, 1)
    expect(calls[0].request.url.endsWith(API.auth.refresh)).toBe(true)
    calls[0].respond({ data: PAIR })

    await waitForCalls(calls, 3)
    calls[1].respond({ data: [] })
    calls[2].respond({ data: [] })
    await Promise.all([first, second])

    const refreshPosts = calls.filter((call) =>
      call.request.url.endsWith(API.auth.refresh)
    )
    expect(refreshPosts).toHaveLength(1)
  })
})

describe("response interceptor", () => {
  it("a 401 is retried once with the refreshed token and then succeeds", async () => {
    const calls = useScriptedHttp()
    saveSession(PAIR)

    const pending = http.get("/catalog/v1/games")
    await waitForCalls(calls, 1)
    calls[0].reject({ status: 401, reason: "TOKEN_EXPIRED" })

    await waitForCalls(calls, 2)
    expect(calls[1].request.url.endsWith(API.auth.refresh)).toBe(true)
    calls[1].respond({ data: PAIR })

    await waitForCalls(calls, 3)
    calls[2].respond({ data: [{ id: "g1" }] })

    await expect(pending).resolves.toMatchObject({
      data: [{ id: "g1" }],
    })
    expect(calls[2].request.headers.Authorization).toBe(
      `Bearer ${PAIR.access_token}`
    )
  })

  it("a 401 with no refresh token available rejects without retrying", async () => {
    const calls = useScriptedHttp()

    const pending = http.get("/catalog/v1/games")
    const rejection = expect(pending).rejects.toBeTruthy()
    await waitForCalls(calls, 1)
    calls[0].reject({ status: 401, reason: "TOKEN_EXPIRED" })

    await rejection
    expect(calls).toHaveLength(1)
  })

  it("a 401 on the retry itself does not loop", async () => {
    const calls = useScriptedHttp()
    saveSession(PAIR)

    const pending = http.get("/catalog/v1/games")
    const rejection = expect(pending).rejects.toBeTruthy()
    await waitForCalls(calls, 1)
    calls[0].reject({ status: 401, reason: "TOKEN_EXPIRED" })

    await waitForCalls(calls, 2)
    calls[1].respond({ data: PAIR })

    await waitForCalls(calls, 3)
    calls[2].reject({ status: 401, reason: "TOKEN_EXPIRED" })

    await rejection
    expect(calls).toHaveLength(3)
  })

  it("a failed write toasts the mapped message once", async () => {
    const calls = useScriptedHttp()
    const error = vi.spyOn(toast, "error")

    const pending = http.post(API.orders.place, { game_id: "g1" })
    const rejection = expect(pending).rejects.toBeTruthy()
    await waitForCalls(calls, 1)
    calls[0].reject({ status: 409, reason: "ALREADY_OWNED" })

    await rejection
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith("This game is already in your library.")
  })

  it("a failed read stays silent — every reading screen has its own empty state", async () => {
    const calls = useScriptedHttp()
    const error = vi.spyOn(toast, "error")

    const pending = http.get("/catalog/v1/games")
    const rejection = expect(pending).rejects.toBeTruthy()
    await waitForCalls(calls, 1)
    calls[0].reject({ status: 500, reason: "INTERNAL" })

    await rejection
    expect(error).not.toHaveBeenCalled()
  })

  it("401 and 404 writes are silent too", async () => {
    const calls = useScriptedHttp()
    const error = vi.spyOn(toast, "error")

    const unauthorised = http.post(API.orders.place, {})
    const missing = http.post("/orders/v1/gifts", {})
    const settled = Promise.allSettled([unauthorised, missing])

    await waitForCalls(calls, 2)
    calls[0].reject({ status: 404, reason: "NOT_FOUND" })
    calls[1].reject({ status: 401, reason: "TOKEN_MISSING" })

    await settled
    expect(error).not.toHaveBeenCalled()
  })
})
