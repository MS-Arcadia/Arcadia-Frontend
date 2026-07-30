/** Transcribed from festival-service/app/application/dto.py. */

import type { Money } from "./common.api.type"

export type FestivalState = "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED"

export interface FestivalView {
  id: string
  name: string
  description: string
  state: FestivalState
  starts_at: string
  ends_at: string
  game_count: number
  created_by: string
  created_at: string
  started_at: string | null
  ended_at: string | null
}

export interface FestivalGameView {
  game_id: string
  title: string
  developer_id: string
  added_by: string
  added_at: string
  /** Only set while an ACTIVE promotion exists for this game. */
  discounted_price: Money | null
  discount_bps: number | null
}

export interface PromotionSnapshotView {
  promotion_id: string
  game_id: string
  state: string
  discount_bps: number
  starts_at: string
  ends_at: string
  list_price: Money | null
  effective_price: Money | null
  updated_at: string
}

export interface FestivalDetailView extends FestivalView {
  games: FestivalGameView[]
  promotions: PromotionSnapshotView[]
}
