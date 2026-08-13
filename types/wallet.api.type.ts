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
