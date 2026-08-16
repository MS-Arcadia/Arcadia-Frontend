import { describe, expect, it } from "vitest"

import { signInSchema, signUpSchema } from "@/schemas/auth.schema"

describe("signInSchema", () => {
  it("accepts a well-formed sign-in", () => {
    expect(
      signInSchema.safeParse({
        email: "player@arcadia.local",
        password: "player-password",
      }).success
    ).toBe(true)
  })

  it.each([
    ["empty email", { email: "", password: "x" }, "email"],
    ["not an email", { email: "player", password: "x" }, "email"],
    ["missing password", { email: "player@arcadia.local", password: "" }, "password"],
  ])("rejects %s on %s", (_name, body, field) => {
    const result = signInSchema.safeParse(body)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual([field])
    }
  })
})

describe("signUpSchema", () => {
  const valid = {
    displayName: "Sam Player",
    email: "player@arcadia.local",
    password: "player-password",
    confirm: "player-password",
  }

  it("accepts a well-formed registration and trims the display name", () => {
    const parsed = signUpSchema.parse({ ...valid, displayName: "  Sam  " })
    expect(parsed.displayName).toBe("Sam")
  })

  it.each([
    ["a one-character display name", { displayName: "S" }, "displayName"],
    ["a 65-character display name", { displayName: "x".repeat(65) }, "displayName"],
    ["a seven-character password", { password: "sevench" }, "password"],
    ["a 129-character password", { password: "x".repeat(129) }, "password"],
    ["a mismatched confirm", { confirm: "different" }, "confirm"],
  ])("rejects %s", (_name, overrides, field) => {
    const result = signUpSchema.safeParse({ ...valid, ...overrides })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(
        true
      )
    }
  })

  it("the mismatch message is on the confirm field, where the user is looking", () => {
    const result = signUpSchema.safeParse({ ...valid, confirm: "other" })
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["confirm"],
        message: "The two passwords do not match",
      })
    }
  })
})
