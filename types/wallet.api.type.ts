/** Transcribed from wallet-service/internal/app/dto.go. */

import type { Money } from "./common.api.type"

export type WalletStatus = "ACTIVE" | "FROZEN" | "CLOSED"

export interface Wallet {
  id: string
  user_id: string
  balance: Money
  /** Committed but not yet spent — a pre-order reservation, mostly. */
  held: Money
  /** `balance` minus `held`. What can actually be spent. */
  available: Money
  status: WalletStatus
  version: number
  created_at: string
  updated_at: string
}

/**
 * The wallet service paginates differently from the Python services.
 *
 * Its `LedgerPage` is `{entries, total_items, page, page_size, total_pages}` —
 * page-numbered — while `Page<T>` elsewhere is `{items, total, limit, offset}`.
 * Reading the ledger as a `Page<T>` meant `items` was always undefined, so the
 * balance rendered and the history below it was permanently empty.
 */
export interface LedgerPage {
  entries: LedgerEntry[]
  total_items: number
  page: number
  page_size: number
  total_pages: number
}

export type LedgerDirection = "CREDIT" | "DEBIT"

export interface LedgerEntry {
  id: string
  sequence: number
  wallet_id: string
  direction: LedgerDirection
  amount: Money
  balance_after: Money
  reason: string
  reference_id?: string
  description?: string
  correlation_id?: string
  created_at: string
}

/**
 * What starting a bank top-up returns.
 *
 * Note what is *not* here: a balance. Initiating a charge moves no money — it
 * only asks the Payment Adapter for a redirect URL. The wallet is credited when
 * the bank confirms and `BankPaymentConfirmed` arrives over Kafka, which is why
 * the balance after a top-up is whatever the next read says rather than
 * something this response can promise.
 */
export interface ChargeResult {
  payment_intent_id: string
  /** Where to send the browser to authorise the payment. */
  redirect_url: string
  amount: Money
  expires_at?: string
  /** True when the same Idempotency-Key returned an existing intent. */
  idempotent_replay: boolean
}

/**
 * Redeeming a gift card credits immediately and returns the wallet with it —
 * unlike a bank charge, no third party has to confirm anything first.
 */
export interface RedeemGiftCardResult {
  credited: Money
  wallet: Wallet
  entry: LedgerEntry
  idempotent_replay: boolean
}

/** One card, exactly as wallet-service's `GiftCardView` is shaped. */
export interface GiftCard {
  id: string
  /**
   * The plaintext code, and **only** in the response that created it. Wallet stores a
   * hash, so a card that is listed later carries an empty string here — there is
   * nothing left to show. A replayed issuance is the same: the codes were never kept.
   */
  code?: string
  /** The last few characters, for telling one issued card from another afterwards. */
  code_hint: string
  value: Money
  status: GiftCardStatus
  issued_by: string
  batch_id?: string
  note?: string
  redeemed_by?: string
  redeemed_at?: string | null
  created_at: string
}

export type GiftCardStatus = "ACTIVE" | "REDEEMED" | "REVOKED"

/**
 * The listing, page-numbered and named after its contents — the same shape as
 * `LedgerPage`, because both come from wallet-service and that is how the Go services
 * paginate. It is **not** `Page<T>`: reading it as one leaves `items` undefined and the
 * table renders empty while the request succeeds.
 */
export interface GiftCardPage {
  gift_cards: GiftCard[]
  total_items: number
  page: number
  page_size: number
  total_pages: number
}

export interface IssueGiftCardsResult {
  batch_id: string
  gift_cards: GiftCard[]
  /** True when this key had already been used. The codes come back empty — they were
   *  revealed once, at issue time, and are not recoverable. */
  idempotent_replay: boolean
}
