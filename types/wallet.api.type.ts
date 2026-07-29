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

export interface TopUpBody {
  amount: Money
  /** The gateway the money comes from. The sandbox one is what runs locally. */
  method?: string
}
