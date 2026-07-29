import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Money, Page } from "@/types/common.api.type"
import type { LedgerEntry, Wallet } from "@/types/wallet.api.type"

export const walletKeys = {
  all: ["wallet"] as const,
  me: () => ["wallet", "me"] as const,
  ledger: () => ["wallet", "ledger"] as const,
}

/** Provisions on first access, which is why there is no "create wallet" call. */
export async function getWallet(): Promise<Wallet> {
  const { data } = await http.get<Wallet>(API.wallet.me)
  return data
}

export async function getLedger(): Promise<Page<LedgerEntry>> {
  const { data } = await http.get<Page<LedgerEntry>>(API.wallet.ledger, {
    params: { limit: 50 },
  })
  return data
}

export async function topUpWallet(amount: Money): Promise<Wallet> {
  const { data } = await http.post<Wallet>(API.wallet.topUp, { amount })
  return data
}
