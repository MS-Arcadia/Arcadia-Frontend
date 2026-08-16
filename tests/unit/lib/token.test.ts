import { describe, expect, it } from "vitest"

import { claimsOf, isExpired, needsRefresh, subjectOf } from "@/lib/token"

import { fakeJwt } from "../../helpers/tokens"

const MINUTE = 60_000

describe("subjectOf", () => {
  it("reads the subject out of a real JWT shape", () => {
    expect(subjectOf(fakeJwt({ sub: "user-42" }))).toBe("user-42")
  })

  it("returns null when there is no subject", () => {
    expect(subjectOf(fakeJwt({}))).toBeNull()
    expect(subjectOf(null)).toBeNull()
    expect(subjectOf(undefined)).toBeNull()
  })

  it("reads the mock adapter's non-JWT `mock.<user-id>.access` shape", () => {
    expect(subjectOf("mock.11111111-1111-4111-8111-111111111111.access")).toBe(
      "11111111-1111-4111-8111-111111111111"
    )
  })

  it("returns null for a malformed mock token", () => {
    expect(subjectOf("mock.only")).toBeNull()
  })
})

describe("claimsOf", () => {
  it("decodes the base64url payload", () => {
    const claims = claimsOf(fakeJwt({ sub: "u1", role: "ADMIN", exp: 123 }))
    expect(claims).toEqual({ sub: "u1", role: "ADMIN", exp: 123 })
  })

  it("never tries to decode the mock shape, and returns null for junk", () => {
    expect(claimsOf("mock.u.access")).toBeNull()
    expect(claimsOf("not-a-jwt")).toBeNull()
    expect(claimsOf("only-one-segment")).toBeNull()
    expect(claimsOf(null)).toBeNull()
    // Three segments whose payload is not base64 JSON.
    expect(claimsOf("a.!!!.b")).toBeNull()
  })
})

describe("expiry", () => {
  it("an expired token is expired", () => {
    expect(isExpired(fakeJwt({ exp: (Date.now() - MINUTE) / 1000 }))).toBe(true)
  })

  it("a live token is not", () => {
    expect(isExpired(fakeJwt({ exp: (Date.now() + MINUTE) / 1000 }))).toBe(
      false
    )
  })

  it("an unknown expiry counts as not expired — the server is the authority", () => {
    expect(isExpired(fakeJwt({}))).toBe(false)
    expect(isExpired("mock.u.access")).toBe(false)
    expect(isExpired(null)).toBe(false)
  })

  it("needsRefresh fires a minute early, so a call does not race the last second", () => {
    const justUnderAMinute = fakeJwt({ exp: (Date.now() + 30_000) / 1000 })
    const justOverAMinute = fakeJwt({ exp: (Date.now() + 90_000) / 1000 })
    expect(needsRefresh(justUnderAMinute)).toBe(true)
    expect(needsRefresh(justOverAMinute)).toBe(false)
    expect(needsRefresh(null)).toBe(false)
  })
})
