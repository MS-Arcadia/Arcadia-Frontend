"use client"

import { useEffect, useState } from "react"
import { Check, Gift, Loader2, Wallet } from "lucide-react"

import {
  GiftRecipientField,
  resolvedGiftRecipient,
  suggestionFitsQuery,
} from "@/components/game/gift-recipient-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useBuyGameMutation,
  useGiftGameMutation,
  useInstalmentOrderMutation,
  usePreorderMutation,
} from "@/queries/orders"
import { useRecipientSuggestQuery } from "@/queries/auth"
import { useWalletQuery } from "@/queries/wallet"
import { formatMoney, isFree, minorToMoney } from "@/lib/money"
import type { RecipientSuggestion } from "@/api/auth"
import type { Game } from "@/types/catalog.api.type"

/** Same 200 bps / half-up as the order service's gift-message fee. */
function giftFeeMinor(priceMinor: bigint, withMessage: boolean): bigint {
  if (!withMessage) return 0n
  return (priceMinor * 200n + 5000n) / 10000n
}

interface Props {
  game: Game
  owned: boolean
  defaultIntent?: string
}

const PLAN_OPTIONS = [3, 4, 6] as const

/**
 * Every way to acquire one game, in one place.
 *
 * Tabs rather than four buttons: they are not four variations on "buy", they are
 * four different commitments with different consequences — one spends, one
 * schedules six weeks of spending, one reserves money without spending it, and
 * one gives the game to somebody else. Each deserves its own copy explaining what
 * happens, which is exactly what a tab panel is for.
 */
export function AcquirePanel({ game, owned, defaultIntent }: Props) {
  const { data: wallet } = useWalletQuery()
  const buy = useBuyGameMutation()
  const gift = useGiftGameMutation()
  const instalment = useInstalmentOrderMutation()
  const reserve = usePreorderMutation()

  const [recipient, setRecipient] = useState("")
  const [picked, setPicked] = useState<RecipientSuggestion | null>(null)
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(recipient.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [recipient])
  const suggestQuery = useRecipientSuggestQuery(debounced)
  const suggestions = (suggestQuery.data ?? []).filter((row) =>
    suggestionFitsQuery(row, recipient)
  )
  const found = resolvedGiftRecipient(recipient, suggestions, picked)
  const trimmed = recipient.trim()
  const caughtUp = debounced === trimmed
  const looking =
    trimmed.length >= 2 &&
    !found &&
    suggestions.length === 0 &&
    (!caughtUp || suggestQuery.isFetching)
  const empty =
    trimmed.length >= 2 &&
    caughtUp &&
    !suggestQuery.isFetching &&
    !found &&
    suggestions.length === 0
  const [message, setMessage] = useState("")
  const [plan, setPlan] = useState<number>(4)

  const price = game.effective_price ?? game.final_price
  const preorder = game.state === "PREORDER"
  const free = isFree(price)
  const minor = price ? BigInt(price.amount_minor) : 0n
  const available = wallet ? BigInt(wallet.available.amount_minor) : null
  const affordable = available === null || available >= minor
  const giftMinor = minor + giftFeeMinor(minor, Boolean(message.trim()))
  const giftAffordable = available === null || available >= giftMinor
  const busy =
    buy.isPending || gift.isPending || instalment.isPending || reserve.isPending

  if (owned) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="size-4 text-brand-sky" />
          This game is in your library
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Buying it again is refused by the catalogue, so there is nothing to do
          here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Tabs defaultValue={defaultIntent === "gift" ? "gift" : "buy"}>
        <TabsList className="w-full">
          <TabsTrigger value="buy" className="flex-1">
            {preorder ? "Reserve" : "Buy"}
          </TabsTrigger>
          {!preorder && !free && (
            <TabsTrigger value="instalments" className="flex-1">
              Instalments
            </TabsTrigger>
          )}
          <TabsTrigger value="gift" className="flex-1">
            Gift
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-4 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {preorder
                ? "Reserved from your wallet"
                : "Charged to your wallet"}
            </span>
            <span className="text-lg font-semibold tabular">
              {formatMoney(price)}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {preorder
              ? "Your money is held, not spent — you can cancel any time before release and the hold is released rather than refunded."
              : "You have twelve hours to change your mind. After that the sale is final."}
          </p>

          <Button
            className="min-h-11 w-full"
            disabled={busy || (!affordable && !free)}
            onClick={() =>
              preorder
                ? reserve.mutate({ game_id: game.id })
                : buy.mutate({ game_id: game.id })
            }
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" />
            )}
            {free ? "Add to library" : preorder ? "Reserve now" : "Buy now"}
          </Button>

          {!affordable && !free && (
            <p className="text-xs text-destructive">
              Your wallet has {formatMoney(wallet?.available)}. Top it up to
              cover the difference.
            </p>
          )}
        </TabsContent>

        {!preorder && !free && (
          <TabsContent value="instalments" className="space-y-4 pt-5">
            <div className="space-y-2">
              <Label className="text-xs">Number of payments</Label>
              <div className="flex gap-2">
                {PLAN_OPTIONS.map((count) => (
                  <Button
                    key={count}
                    variant={plan === count ? "default" : "outline"}
                    size="sm"
                    className="min-h-9 flex-1 tabular"
                    onClick={() => setPlan(count)}
                  >
                    {count}×
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Due today</span>
              <span className="text-lg font-semibold tabular">
                {formatMoney(
                  minorToMoney(minor / BigInt(plan), price?.currency ?? "IRR")
                )}
              </span>
            </div>

            {/* The honest version of the arithmetic: the parts are equal except
                the last, which carries the remainder — the same way the order
                service builds the schedule. Saying "about" would be vaguer than
                necessary and hiding it would misstate the final payment. */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {plan} payments, 30 days apart. The game is yours from the first
              one. Miss a payment for longer than the grace period and the game
              is removed — what you have already paid is not returned.
            </p>

            <Button
              className="min-h-11 w-full"
              disabled={busy}
              onClick={() =>
                instalment.mutate({
                  game_id: game.id,
                  instalments: plan,
                  interval_days: 30,
                })
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Start the plan
            </Button>
          </TabsContent>
        )}

        <TabsContent value="gift" className="space-y-4 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Charged to your wallet
            </span>
            <span className="text-lg font-semibold tabular">
              {formatMoney(minorToMoney(giftMinor, price?.currency ?? "IRR"))}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            You pay. They get the game. Nothing is taken from their wallet.
          </p>

          <GiftRecipientField
            value={recipient}
            onChange={(next) => {
              setRecipient(next)
              setPicked(null)
            }}
            onPick={(person) => {
              setPicked(person)
              setRecipient(person.email)
            }}
            suggestions={suggestions}
            found={found}
            loading={looking}
            empty={empty}
          />

          <div className="space-y-2">
            <Label htmlFor="message" className="text-xs">
              Message <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="They will read this when it arrives"
              className="min-h-11"
            />
            {message.trim() && (
              <p className="text-xs text-muted-foreground">
                A message adds 2% to the price.
              </p>
            )}
          </div>

          <Button
            className="min-h-11 w-full"
            // Nothing to send until we know who to. The id comes from the
            // suggestion they picked — never from the box as a raw string.
            disabled={busy || !found || (!giftAffordable && !free)}
            onClick={() =>
              found &&
              gift.mutate({
                game_id: game.id,
                recipient_id: found.user_id,
                message: message.trim() || undefined,
              })
            }
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Gift className="size-4" />
            )}
            Send the gift
          </Button>

          {!giftAffordable && !free && (
            <p className="text-xs text-destructive">
              Your wallet has {formatMoney(wallet?.available)}. Top it up to
              cover the gift.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
