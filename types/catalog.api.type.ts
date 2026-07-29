/** Transcribed from catalog-service/app/application/dto.py. */

import type { Money } from "./common.api.type"

export type GameState =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "APPEALED"
  | "PRICED"
  /** Buyable before release: money is committed now, the entitlement at release. */
  | "PREORDER"
  | "PUBLISHED"

export type MediaKind = "SCREENSHOT" | "TRAILER" | "COVER" | "TEASER"

export interface GameMedia {
  id: string
  kind: MediaKind
  media_ref: string
  position: number
}

export interface GameVersion {
  id: string
  version: string
  file_ref: string
  size_bytes: number
  uploaded_at: string
  notes: string
}

export interface Promotion {
  id: string
  game_id: string
  /** Basis points off. 2000 is 20%, 10000 makes the game free. */
  discount_bps: number
  percent_off: number
  state: string
  starts_at: string
  ends_at: string
  live: boolean
  proposed_by: string
  festival_id: string
  note: string
  decided_by: string
  decision_note: string
  created_at: string | null
}

export interface Game {
  id: string
  developer_id: string
  title: string
  description: string
  min_requirements: string
  state: GameState
  genres: string[]
  tags: string[]
  suggested_price: Money | null
  final_price: Money | null
  teaser_ref: string
  /**
   * What a buyer pays right now, discount included. Separate from `final_price`
   * so a storefront can strike one through the other — and computed server-side
   * on purpose, so nobody reimplements the discount arithmetic and rounds it
   * differently.
   */
  effective_price: Money | null
  discount_bps: number
  withdrawn_at: string | null
  withdrawal_reason: string
  release_at: string | null
  versions: GameVersion[]
  media: GameMedia[]
  created_at: string | null
  updated_at: string | null
  published_at: string | null
}

/** The developer's and staff's view: adds the internal review conversation. */
export interface GameDetail extends Game {
  reviews: GameReview[]
  promotions: Promotion[]
}

export interface GameReview {
  id: string
  support_id: string
  decision: string
  note: string
  at: string
  appealed: boolean
  appeal_note: string
}

export interface Ownership {
  id: string
  game_id: string
  owner_id: string
  order_id: string
  status: string
  granted_at: string | null
  revoked_at: string | null
  gifted_by: string
}
