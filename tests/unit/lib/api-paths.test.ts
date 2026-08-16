import { describe, expect, it } from "vitest"

import { API } from "@/lib/api-paths"

/**
 * These paths are the gateway's own routing table in string form: a typo is a
 * 404 that only shows up against the real platform, because the mock adapter
 * happily answers whatever route was registered. TypeScript cannot check string
 * literals against a Go router, so this is the next best thing — every path
 * pinned to its service prefix and shape.
 */

/** Every string path in the API tree, flattened with its dotted address. */
function flatten(
  tree: unknown,
  prefix = ""
): { address: string; path: string }[] {
  return Object.entries(tree as Record<string, unknown>).flatMap(
    ([key, value]) => {
      const address = prefix ? `${prefix}.${key}` : key
      if (typeof value === "string") return [{ address, path: value }]
      if (typeof value === "function") return []
      return flatten(value, address)
    }
  )
}

const ALL_PATHS = flatten(API)

describe("every path is service-prefixed", () => {
  const PREFIXES = [
    "/auth/",
    "/catalog/",
    "/orders/",
    "/wallet/",
    "/mock-bank/",
    "/notifications/",
    "/marketplace/",
    "/reviews/",
    "/festivals/",
    "/community/",
    "/recommendations/",
    "/media/",
  ]

  it("each starts with exactly one known service prefix", () => {
    expect(ALL_PATHS.length).toBeGreaterThan(40)
    for (const { address, path } of ALL_PATHS) {
      const matches = PREFIXES.filter((prefix) => path.startsWith(prefix))
      expect(
        matches,
        `${address} -> ${path} should match exactly one service prefix`
      ).toHaveLength(1)
    }
  })

  it("no path carries a scheme or host — the base URL owns that", () => {
    for (const { address, path } of ALL_PATHS) {
      expect(path, address).not.toMatch(/^https?:/)
    }
  })
})

describe("paths whose shape has bitten before", () => {
  it("the auth service has no /users/me — a profile is fetched by id", () => {
    expect(API.auth.profile("u1")).toBe("/auth/v1/profile/u1")
    expect(JSON.stringify(API.auth)).not.toContain("/users/me")
  })

  it("wallet charges is /charges, not the /top-ups no service has ever served", () => {
    expect(API.wallet.charges).toBe("/wallet/v1/wallets/me/charges")
  })

  it("review creation keeps its load-bearing trailing slash", () => {
    expect(API.reviews.create).toBe("/reviews/api/reviews/")
  })

  it("catalog's game routes sit under /v1/games, workflow routes at /v1", () => {
    expect(API.catalog.games).toBe("/catalog/v1/games")
    expect(API.catalog.library).toBe("/catalog/v1/library")
    expect(API.catalog.submit("g1")).toBe("/catalog/v1/games/g1/submit")
  })

  it("path builders interpolate their ids", () => {
    expect(API.orders.detail("o1")).toBe("/orders/v1/orders/o1")
    expect(API.orders.refund("o1")).toBe("/orders/v1/orders/o1/refund")
    expect(API.catalog.approvePromotion("g1", "p1")).toBe(
      "/catalog/v1/games/g1/promotions/p1/approve"
    )
    expect(API.festivals.removeGame("f1", "g1")).toBe(
      "/festivals/v1/festivals/f1/games/g1"
    )
    expect(API.reviews.resolveReport("r1", "p1")).toBe(
      "/reviews/api/reviews/r1/reports/p1/resolve"
    )
  })
})
