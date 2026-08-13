"use client"

import { useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Landmark,
  Loader2,
  Lock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useInitiateChargeMutation,
  useLedgerQuery,
  useRedeemGiftCardMutation,
  useWalletQuery,
} from "@/queries/wallet"
import { formatDateTime } from "@/lib/datetime"
import { formatMoney, isZero, minorToMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

const QUICK_AMOUNTS = [500_000, 1_000_000, 5_000_000]

/** The ledger's own vocabulary, in words a person recognises. Reasons come from
 *  the wallet service; anything unmapped falls back to the raw code rather than
 *  to a guess. */
const REASON_LABEL: Record<string, string> = {
  PURCHASE: "Purchase",
  REFUND: "Refund",
  TOP_UP: "Top-up",
  ADMIN_ADJUSTMENT: "Adjustment",
  REVENUE_SHARE: "Revenue share",
  GIFT_CARD: "Gift card",
  HOLD: "Reserved",
  HOLD_RELEASED: "Reservation released",
}

export default function WalletPage() {
  const { data: wallet, isPending } = useWalletQuery()
  const { data: ledger } = useLedgerQuery()
  const charge = useInitiateChargeMutation()
  const redeem = useRedeemGiftCardMutation()
  const [amount, setAmount] = useState("")
  const [giftCode, setGiftCode] = useState("")

  const held = wallet && !isZero(wallet.held)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <h1 className="text-xl font-semibold">Wallet</h1>

      {isPending ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs text-muted-foreground">Available to spend</p>
          <p className="mt-1 font-display text-4xl font-bold tabular">
            {formatMoney(wallet?.available)}
          </p>

          {held && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" strokeWidth={1.75} />
              <span className="tabular">{formatMoney(wallet?.held)}</span> is
              reserved for a pre-order — committed, but not spent yet.
            </p>
          )}

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <Label htmlFor="topup" className="text-xs">
              Add money
            </Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((value) => (
                <Button
                  key={value}
                  variant="outline"
                  size="sm"
                  className="min-h-9 tabular"
                  onClick={() => setAmount(String(value))}
                >
                  {formatMoney(minorToMoney(BigInt(value) * 100n))}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                id="topup"
                inputMode="numeric"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="Any amount"
                className="min-h-11 tabular"
              />
              <Button
                className="min-h-11 shrink-0"
                disabled={!amount || charge.isPending}
                onClick={() =>
                  charge.mutate(minorToMoney(BigInt(amount) * 100n))
                }
              >
                {charge.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Landmark className="size-4" />
                )}
                Continue to bank
              </Button>
            </div>
            {/* Said before the redirect rather than discovered after it: the
                balance does not move until the bank confirms, and a user who
                expects an instant top-up reads a stale balance as a bug. */}
            <p className="text-xs text-muted-foreground">
              You will authorise the payment at your bank. The balance updates
              once they confirm it.
            </p>

            <div className="space-y-3 border-t border-border pt-5">
              <Label htmlFor="giftcard" className="text-xs">
                Redeem a gift card
              </Label>
              <div className="flex gap-2">
                <Input
                  id="giftcard"
                  value={giftCode}
                  onChange={(event) =>
                    setGiftCode(event.target.value.toUpperCase())
                  }
                  placeholder="ARCA-DIA1-GIFT"
                  className="min-h-11 font-mono tracking-wider"
                />
                <Button
                  variant="outline"
                  className="min-h-11 shrink-0"
                  disabled={!giftCode.trim() || redeem.isPending}
                  onClick={() =>
                    redeem.mutate(giftCode, {
                      onSuccess: () => setGiftCode(""),
                    })
                  }
                >
                  {redeem.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Gift className="size-4" />
                  )}
                  Redeem
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A card credits straight away — no bank involved.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Every movement</h2>
        <p className="text-xs text-muted-foreground">
          The balance above is the sum of these entries. Nothing is edited after
          the fact — a refund is a new credit, not a reversal of the debit.
        </p>

        <ul className="divide-y divide-border rounded-xl border border-border">
          {(ledger?.entries ?? []).map((entry) => {
            const credit = entry.direction === "CREDIT"
            return (
              <li key={entry.id} className="flex items-center gap-3 p-4">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    credit
                      ? "bg-brand-sky/15 text-brand-sky"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {credit ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {entry.description ||
                      REASON_LABEL[entry.reason] ||
                      entry.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </p>
                </div>

                <div className="text-end">
                  <p
                    className={cn(
                      "text-sm font-medium tabular",
                      credit && "text-brand-sky"
                    )}
                  >
                    {credit ? "+" : "−"}
                    {formatMoney(entry.amount).replace("−", "")}
                  </p>
                  <p className="text-xs text-muted-foreground tabular">
                    {formatMoney(entry.balance_after)}
                  </p>
                </div>
              </li>
            )
          })}

          {ledger && ledger.entries.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">
              Nothing has moved yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
