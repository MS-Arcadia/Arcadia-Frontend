import { describe, expect, it } from "vitest"

import {
  addMoney,
  currencyLabel,
  divideMinor,
  formatAmount,
  formatMoney,
  formatNumber,
  isFree,
  isZero,
  minorToMoney,
  percentOff,
} from "@/lib/money"

describe("formatMoney", () => {
  it("renders an em dash for a missing amount", () => {
    expect(formatMoney(null)).toBe("—")
    expect(formatMoney(undefined)).toBe("—")
  })

  it("drops a zero minor part — '10,000.00 IRR' is noise on a store page", () => {
    expect(formatMoney({ amount_minor: "1000000", currency: "IRR" })).toBe(
      "10,000 IRR"
    )
  })

  it("keeps a non-zero minor part, zero-padded to two digits", () => {
    expect(formatMoney({ amount_minor: "100050", currency: "IRR" })).toBe(
      "1,000.50 IRR"
    )
  })

  it("survives an amount beyond 2^53 exactly — the reason amount_minor is a string", () => {
    // 2^53 + 1 is not representable as a JS number; as a BigInt it is exact.
    expect(
      formatMoney({ amount_minor: "9007199254740993", currency: "IRR" })
    ).toBe("90,071,992,547,409.93 IRR")
  })

  it("puts a one-character symbol in front, a code behind", () => {
    expect(formatMoney({ amount_minor: "12345", currency: "USD" })).toBe(
      "$123.45"
    )
    expect(formatMoney({ amount_minor: "12345", currency: "EUR" })).toBe(
      "€123.45"
    )
  })

  it("falls back to the raw code for a currency it does not know", () => {
    expect(formatMoney({ amount_minor: "500", currency: "GBP" })).toBe("5 GBP")
  })

  it("prefixes a real minus sign for a negative amount", () => {
    expect(formatMoney({ amount_minor: "-150", currency: "IRR" })).toBe(
      "−1.50 IRR"
    )
  })

  it("treats an unparseable amount as zero rather than throwing", () => {
    expect(formatMoney({ amount_minor: "not-a-number", currency: "IRR" })).toBe(
      "0 IRR"
    )
  })
})

describe("formatAmount", () => {
  it("formats the number only, for places that label the currency", () => {
    expect(formatAmount({ amount_minor: "250000", currency: "IRR" })).toBe(
      "2,500"
    )
  })

  it("renders an em dash for a missing amount", () => {
    expect(formatAmount(null)).toBe("—")
  })
})

describe("formatNumber", () => {
  it("groups any integer or bigint, for counts rather than money", () => {
    expect(formatNumber(1234567)).toBe("1,234,567")
    expect(formatNumber(10n ** 18n)).toBe("1,000,000,000,000,000,000")
  })
})

describe("zero and free", () => {
  it("a null amount counts as zero", () => {
    expect(isZero(null)).toBe(true)
  })

  it("zero minor units are zero, and therefore free", () => {
    const free = { amount_minor: "0", currency: "IRR" }
    expect(isZero(free)).toBe(true)
    expect(isFree(free)).toBe(true)
  })

  it("a priced amount is neither", () => {
    const priced = { amount_minor: "1", currency: "IRR" }
    expect(isZero(priced)).toBe(false)
    expect(isFree(priced)).toBe(false)
  })
})

describe("currencyLabel", () => {
  it("maps known currencies to their symbol", () => {
    expect(currencyLabel("IRR")).toBe("IRR")
    expect(currencyLabel("USD")).toBe("$")
  })

  it("passes an unknown currency through", () => {
    expect(currencyLabel("JPY")).toBe("JPY")
  })
})

describe("percentOff", () => {
  it("renders whole percentages without a fraction", () => {
    expect(percentOff(2000)).toBe("20")
    expect(percentOff(10000)).toBe("100")
    expect(percentOff(0)).toBe("0")
  })

  it("keeps one decimal for fractional bps — 1250 shown as 13 would misstate a price", () => {
    expect(percentOff(1250)).toBe("12.5")
  })
})

describe("arithmetic", () => {
  it("adds two amounts and stays a string on the wire", () => {
    expect(
      addMoney(
        { amount_minor: "9007199254740993", currency: "IRR" },
        { amount_minor: "7", currency: "IRR" }
      )
    ).toEqual({ amount_minor: "9007199254741000", currency: "IRR" })
  })

  it("builds a Money from a bigint or number of minor units", () => {
    expect(minorToMoney(1500n)).toEqual({
      amount_minor: "1500",
      currency: "IRR",
    })
    expect(minorToMoney(42, "USD")).toEqual({
      amount_minor: "42",
      currency: "USD",
    })
  })

  it("divides by truncating — the caller owns the remainder", () => {
    // 1000.00 split three ways is 333.33 each; the extra minor unit is the
    // last instalment's problem, exactly as the order service does it.
    expect(divideMinor({ amount_minor: "100000", currency: "IRR" }, 3)).toEqual(
      { amount_minor: "33333", currency: "IRR" }
    )
  })
})
