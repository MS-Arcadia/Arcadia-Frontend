/** Transcribed from order-service/app/application/dto.py. */

import type { Money } from "./common.api.type"

export type OrderType = "PURCHASE" | "GIFT" | "PREORDER" | "INSTALMENT"

/**
 * Ten states, and the unobvious ones are unobvious in the backend too:
 *
 * - `REFUNDING` — the refund commands are out but the wallet has not confirmed.
 *   Claiming REFUNDED before that would overstate what happened to somebody's money.
 * - `PAYING` — an instalment sale, delivered and still being collected. Not
 *   COMPLETED: the buyer has the game, the platform has not been paid for it.
 * - `DEFAULTED` — the buyer stopped paying and the entitlement was revoked. What
 *   they already paid is not returned, so it is not REFUNDED; the sale did
 *   happen, so it is not FAILED.
 * - `CANCELLED` — a pre-order abandoned before release. The hold was released
 *   rather than refunded, so nothing went wrong.
 */
export type OrderState =
  | "PENDING"
  | "RESERVED"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDING"
  | "REFUNDED"
  | "CANCELLED"
  | "PAYING"
  | "DEFAULTED"

export interface Gift {
  recipient_id: string
  message: string
  message_fee: Money | null
}

/** How far the distributed transaction got. Shown because a PENDING order is
 *  otherwise indistinguishable from a stuck one. */
export interface Saga {
  step: string
  status: string
  attempts: number
  last_error: string
}

export interface Order {
  id: string
  buyer_id: string
  game_id: string
  game_title: string
  developer_id: string
  type: OrderType
  state: OrderState
  base_price: Money
  total_charged: Money
  developer_share: Money
  platform_share: Money
  discount: Money | null
  discount_code: string
  gift: Gift | null
  failure_reason: string
  failure_message: string
  created_at: string | null
  completed_at: string | null
  refunded_at: string | null
  /** When the twelve-hour window closes. Sent by the server so a client shows it
   *  rather than computing it and disagreeing. */
  refundable_until: string | null
  cancellable: boolean
  saga: Saga | null
  idempotent_replay: boolean
}

export type InstalmentState = "SCHEDULED" | "DUE" | "PAID" | "MISSED"

export interface Instalment {
  number: number
  of_total: number
  amount: Money
  due_at: string
  state: InstalmentState
  paid_at: string | null
}

export interface InstalmentPlan {
  id: string
  order_id: string
  buyer_id: string
  game_id: string
  state: string
  total: Money
  paid: Money
  outstanding: Money
  grace_days: number
  deadline: string | null
  next_due_at: string | null
  defaults_at: string | null
  instalments: Instalment[]
  created_at: string | null
}

export interface PlaceOrderBody {
  game_id: string
  discount_code?: string
}

export interface PlaceGiftBody {
  game_id: string
  recipient_id: string
  message?: string
}

export interface PlaceInstalmentBody {
  game_id: string
  instalments: number
  interval_days: number
}
