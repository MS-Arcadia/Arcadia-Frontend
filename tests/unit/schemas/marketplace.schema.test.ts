import { describe, expect, it } from "vitest"

import { newMarketItemSchema, toMinorUnits } from "@/schemas/marketplace.schema"

const valid = {
  gameId: "game-1",
  title: "Neon Drift key",
  description: "One key, unused.",
  buyPrice: "300000",
  sellPrice: "320000",
}

describe("newMarketItemSchema", () => {
  it("accepts a listing with digit-string prices", () => {
    expect(newMarketItemSchema.safeParse(valid).success).toBe(true)
  })

  it("refuses a non-digit price before BigInt would see it", () => {
    expect(
      newMarketItemSchema.safeParse({ ...valid, buyPrice: "300,000" }).success
    ).toBe(false)
    expect(
      newMarketItemSchema.safeParse({ ...valid, sellPrice: "" }).success
    ).toBe(false)
  })

  it("refuses a zero or negative price", () => {
    expect(
      newMarketItemSchema.safeParse({ ...valid, buyPrice: "0" }).success
    ).toBe(false)
    expect(
      newMarketItemSchema.safeParse({ ...valid, sellPrice: "-5" }).success
    ).toBe(false)
  })

  it("the title obeys market.maxTitle (120), and no game picked is refused", () => {
    expect(
      newMarketItemSchema.safeParse({ ...valid, title: "x".repeat(121) })
        .success
    ).toBe(false)
    expect(
      newMarketItemSchema.safeParse({ ...valid, gameId: " " }).success
    ).toBe(false)
  })
})

describe("toMinorUnits", () => {
  it("converts major-unit digits to a minor-unit string — never Number()", () => {
    expect(toMinorUnits("300000")).toBe("30000000")
    expect(toMinorUnits("0")).toBe("0")
  })

  it("stays exact past 2^53, where a float would already be lying", () => {
    expect(toMinorUnits("9007199254740993")).toBe("900719925474099300")
  })
})
