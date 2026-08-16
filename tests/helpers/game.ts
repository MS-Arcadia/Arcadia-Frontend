import type { Money } from "@/types/common.api.type"
import type { Game, GameDetail, GameState } from "@/types/catalog.api.type"

function irr(major: number): Money {
  return { amount_minor: String(BigInt(major) * 100n), currency: "IRR" }
}

/** A wire-shaped Game with the fields the price and badge components read. */
export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-1",
    developer_id: "22222222-2222-4222-8222-222222222222",
    title: "Neon Drift",
    description: "A race through streets with no name.",
    min_requirements: "Any machine from the last decade.",
    state: "PUBLISHED" as GameState,
    genres: ["Racing", "Indie"],
    tags: [],
    suggested_price: null,
    final_price: irr(480_000),
    teaser_ref: "/covers/neon-drift.svg",
    effective_price: irr(480_000),
    discount_bps: 0,
    withdrawn_at: null,
    withdrawal_reason: "",
    release_at: null,
    versions: [],
    media: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    published_at: "2026-01-02T00:00:00Z",
    ...overrides,
  }
}

/** A GameDetail is a Game plus the relations the detail endpoint inlines. */
export function makeGameDetail(
  overrides: Partial<GameDetail> = {}
): GameDetail {
  return { ...makeGame(overrides), reviews: [], promotions: [], ...overrides }
}

export { irr as majorIrr }
