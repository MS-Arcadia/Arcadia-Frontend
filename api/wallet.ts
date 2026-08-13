import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Money, Page } from "@/types/common.api.type"
import type {
  ChargeResult,
  LedgerEntry,
  RedeemGiftCardResult,
  Wallet,
} from "@/types/wallet.api.type"

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

/**
 * Starts a bank top-up and returns where to send the browser.
 *
 * Deliberately returns no balance: initiating a charge moves no money. The
 * wallet is credited when the bank confirms and the payment service publishes
 * `BankPaymentConfirmed`, so the caller redirects and re-reads the wallet when
 * the user comes back.
 *
 * `return_url` is where the bank sends the user afterwards. It has to be an
 * absolute URL the browser can reach, which is why it is built from the current
 * origin rather than configured.
 */
export async function initiateCharge(amount: Money): Promise<ChargeResult> {
  const { data } = await http.post<ChargeResult>(API.wallet.charges, {
    amount,
    return_url: `${window.location.origin}/wallet`,
  })
  return data
}

/** Credits immediately — no bank, no redirect. */
export async function redeemGiftCard(
  code: string
): Promise<RedeemGiftCardResult> {
  const { data } = await http.post<RedeemGiftCardResult>(
    API.wallet.redeemGiftCard,
    { code: code.trim() }
  )
  return data
}
