import { describe, expect, it } from "vitest"

import { NAV_ITEMS, STAFF_NAV, isCurrent, navFor } from "@/lib/navigation"

describe("navFor", () => {
  it("no role means no staff navigation at all", () => {
    expect(navFor(undefined)).toEqual([])
  })

  it("a basic user sees nothing gated", () => {
    expect(navFor("BASIC_USER")).toEqual([])
  })

  it("a developer sees exactly their item", () => {
    expect(navFor("DEVELOPER").map((item) => item.href)).toEqual(["/developer"])
  })

  it("support sees the review queue, reports and gift cards", () => {
    expect(navFor("SUPPORT").map((item) => item.href)).toEqual([
      "/review",
      "/community-reports",
      "/gift-cards",
    ])
  })

  it("an admin sees everything support does, plus accounts", () => {
    expect(navFor("ADMIN").map((item) => item.href)).toEqual([
      "/review",
      "/community-reports",
      "/gift-cards",
      "/admin",
    ])
  })
})

describe("the nav tables", () => {
  it("every entry has an href, label and icon", () => {
    for (const item of [...NAV_ITEMS, ...STAFF_NAV]) {
      expect(item.href.startsWith("/")).toBe(true)
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.icon).toBeDefined()
    }
  })

  it("hrefs are unique across both tables", () => {
    const hrefs = [...NAV_ITEMS, ...STAFF_NAV].map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

describe("isCurrent", () => {
  it("matches exactly and by prefix, so /orders/abc highlights Orders", () => {
    expect(isCurrent("/orders", "/orders")).toBe(true)
    expect(isCurrent("/orders/abc123", "/orders")).toBe(true)
  })

  it("a sibling prefix does not match", () => {
    expect(isCurrent("/orders-archive", "/orders")).toBe(false)
    expect(isCurrent("/store", "/orders")).toBe(false)
  })
})
