"use client"

import { useState } from "react"
import { Check, Copy, Gift, Loader2, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useGiftCardsQuery, useIssueGiftCardsMutation } from "@/queries/wallet"
import { formatDate } from "@/lib/datetime"
import { formatMoney, minorToMoney } from "@/lib/money"
import { useHasRole } from "@/stores/auth.store"
import type { GiftCard } from "@/types/wallet.api.type"

const CURRENCY = "IRR"
const QUANTITIES = [1, 5, 10, 25] as const

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Unused",
  REDEEMED: "Redeemed",
  REVOKED: "Revoked",
}

/**
 * Issuing gift cards, requirement 1.1.
 *
 * wallet-service has served this since it was written and nothing called it — there was
 * no way to create a card in the product, only to redeem one, so the redeem box on the
 * wallet page could never be given anything to redeem.
 *
 * Its own page rather than a panel on `/admin`, because the service allows Support and
 * Admin both and that screen is Admin-only. Putting it there would have hidden the
 * feature from half the people entitled to use it.
 */
export function GiftCardsPage() {
  // Two calls, both unconditional: `||` would short-circuit the second and the hook
  // order would change between renders.
  const isSupport = useHasRole("SUPPORT")
  const isAdmin = useHasRole("ADMIN")
  const isStaff = isSupport || isAdmin
  const [amount, setAmount] = useState("500000")
  const [quantity, setQuantity] = useState<number>(1)
  const [note, setNote] = useState("")
  const [justIssued, setJustIssued] = useState<GiftCard[]>([])

  const issue = useIssueGiftCardsMutation()
  const { data, isPending } = useGiftCardsQuery(isStaff)

  if (!isStaff) {
    return (
      <div className="mx-auto w-full max-w-lg py-20 text-center">
        <ShieldAlert
          className="mx-auto size-8 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden
        />
        <h1 className="mt-4 text-lg font-semibold">Support and admins only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gift cards are money, so only staff can create them.
        </p>
      </div>
    )
  }

  const cards = data?.gift_cards ?? []
  const digits = amount.replace(/\D/g, "")
  const valid = digits.length > 0 && BigInt(digits || "0") > 0n

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Gift cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A code somebody redeems into their wallet. Issuing one moves no money
          on its own — the balance appears when it is redeemed.
        </p>
      </div>

      <section className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-xs">
              Value of each card
            </Label>
            <Input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="min-h-11 tabular"
            />
            <p className="text-xs text-muted-foreground">
              {valid
                ? formatMoney(minorToMoney(BigInt(digits), CURRENCY))
                : "Enter an amount"}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">How many</Label>
            <div className="flex gap-2">
              {QUANTITIES.map((count) => (
                <Button
                  key={count}
                  variant={quantity === count ? "default" : "outline"}
                  size="sm"
                  className="min-h-9 flex-1 tabular"
                  onClick={() => setQuantity(count)}
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note" className="text-xs">
            Note <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What this batch is for — refund, competition, apology"
            className="min-h-11"
          />
        </div>

        <Button
          className="min-h-11 gap-2"
          disabled={!valid || issue.isPending}
          onClick={() =>
            issue.mutate(
              {
                amountMinor: digits,
                currency: CURRENCY,
                quantity,
                note,
              },
              { onSuccess: (result) => setJustIssued(result.gift_cards) }
            )
          }
        >
          {issue.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Gift className="size-4" />
          )}
          Issue {quantity === 1 ? "a card" : `${quantity} cards`}
        </Button>
      </section>

      {/* The codes exist in the issuing response and nowhere else — the service keeps a
          hash, so listing them below returns the same cards with no code at all. If they
          are not copied now they are gone, and saying so is the only honest option. */}
      {justIssued.length > 0 && (
        <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div>
            <h2 className="text-sm font-semibold">
              Copy these now — they are shown once
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Arcadia stores a hash of each code, not the code. Once you leave
              this page there is no way to read them again.
            </p>
          </div>
          <ul className="space-y-2">
            {justIssued.map((card) => (
              <IssuedCode key={card.id} card={card} />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Issued</h2>

        {isPending && <Skeleton className="h-24 w-full rounded-xl" />}

        {!isPending && cards.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No gift cards yet. The ones you issue appear here with their value
            and whether they have been used.
          </p>
        )}

        {cards.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-140 text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">Code</th>
                  <th className="px-4 py-2 text-start font-medium">Value</th>
                  <th className="px-4 py-2 text-start font-medium">Status</th>
                  <th className="px-4 py-2 text-start font-medium">Issued</th>
                  <th className="px-4 py-2 text-start font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-mono text-xs">
                      …{card.code_hint}
                    </td>
                    <td className="px-4 py-2 tabular">
                      {formatMoney(card.value)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          card.status === "ACTIVE" ? "default" : "secondary"
                        }
                      >
                        {STATUS_LABEL[card.status] ?? card.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(card.created_at)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {card.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/** One freshly minted code, with the only chance anybody gets to copy it. */
function IssuedCode({ card }: { card: GiftCard }) {
  const [copied, setCopied] = useState(false)

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <code className="flex-1 font-mono text-sm break-all">{card.code}</code>
      <span className="text-xs text-muted-foreground tabular">
        {formatMoney(card.value)}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="min-h-9 gap-1.5"
        onClick={() => {
          void navigator.clipboard.writeText(card.code ?? "")
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
    </li>
  )
}
