import { describe, expect, it } from "vitest"

import {
  newGameSchema,
  promotionSchema,
  reviewDecisionSchema,
} from "@/schemas/game.schema"

describe("newGameSchema", () => {
  const valid = {
    title: "Glasshouse",
    description: "A city where everything is transparent.",
    minRequirements: "Any machine from the last decade.",
    genres: "Adventure",
  }

  it("accepts a complete registration and trims the text fields", () => {
    expect(newGameSchema.parse({ ...valid, title: " Glasshouse " }).title).toBe(
      "Glasshouse"
    )
  })

  it.each([
    ["no title", { title: " " }],
    ["a 201-character title", { title: "x".repeat(201) }],
    ["a description past the catalog's cap", { description: "x".repeat(10_001) }],
    ["requirements past the cap", { minRequirements: "x".repeat(4_001) }],
    ["a one-character genre", { genres: "A" }],
  ])("refuses %s — the service would refuse it too", (_name, overrides) => {
    expect(newGameSchema.safeParse({ ...valid, ...overrides }).success).toBe(
      false
    )
  })
})

describe("reviewDecisionSchema", () => {
  it("accepts a note within the cap and an empty one", () => {
    expect(reviewDecisionSchema.safeParse({ note: "Looks good" }).success).toBe(
      true
    )
    expect(reviewDecisionSchema.safeParse({ note: "" }).success).toBe(true)
  })

  it("refuses a novel-length note", () => {
    expect(
      reviewDecisionSchema.safeParse({ note: "x".repeat(2001) }).success
    ).toBe(false)
  })
})

describe("promotionSchema — basis points under the hood", () => {
  it("accepts a whole-percentage window between a day and ninety days", () => {
    expect(
      promotionSchema.safeParse({ percent: 20, days: 14 }).success
    ).toBe(true)
  })

  it("accepts a fractional percentage, which the catalog takes", () => {
    expect(promotionSchema.safeParse({ percent: 12.5, days: 7 }).success).toBe(
      true
    )
  })

  it.each([
    ["0%", { percent: 0, days: 7 }],
    ["101%", { percent: 101, days: 7 }],
    ["zero days", { percent: 20, days: 0 }],
    ["ninety-one days", { percent: 20, days: 91 }],
    ["a string percent", { percent: "20" as unknown as number, days: 7 }],
  ])("refuses %s", (_name, body) => {
    expect(promotionSchema.safeParse(body).success).toBe(false)
  })
})
