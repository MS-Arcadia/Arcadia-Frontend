"use client"

import Link from "next/link"
import { MediaImage } from "@/components/media-image"
import { Download, Gift, LibraryBig } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RefundButton } from "@/components/order/refund-button"
import { useLibraryQuery, useOwnedGamesQuery } from "@/queries/catalog"
import { useOrdersQuery } from "@/queries/orders"
import { formatDate } from "@/lib/datetime"
import { formatNumber } from "@/lib/money"
import { gameArt } from "@/lib/game-art"
import { isRefundable } from "@/lib/order-refund"

export default function LibraryPage() {
  const { data, isPending: libraryPending } = useLibraryQuery()
  const { data: orders } = useOrdersQuery()
  const entries = data?.items ?? []

  // The library answers ownership records, not games — no title, no art, just `game_id`.
  // Each one is fetched on its own so it shares a cache entry with the store and the game
  // page rather than being a third copy of the same title.
  const { games, isPending: gamesPending } = useOwnedGamesQuery(
    entries.map((entry) => entry.game_id)
  )
  const isPending = libraryPending || (entries.length > 0 && gamesPending)

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">Library</h1>
        {data && (
          <span className="text-sm text-muted-foreground tabular">
            {formatNumber(entries.length)}{" "}
            {entries.length === 1 ? "game" : "games"}
          </span>
        )}
      </div>

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isPending && entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <LibraryBig
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Games you buy, receive as a gift, or start a payment plan for all
            show up here — a plan puts the game in your library from the first
            payment.
          </p>
          <Button
            className="mt-5 min-h-11"
            nativeButton={false}
            render={<Link href="/store" />}
          >
            Browse the store
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((ownership) => {
          const game = games.get(ownership.game_id)
          if (!game) return null
          const art = gameArt(game.media)
          const order = orders?.items.find(
            (candidate) => candidate.id === ownership.order_id
          )
          const refundable =
            !ownership.gifted_by && order && isRefundable(order)
          return (
            <article
              key={ownership.id}
              className="flex gap-4 overflow-hidden rounded-xl border border-border bg-card p-3"
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {art && (
                  <MediaImage
                    src={art.media_ref}
                    alt=""
                    fill
                    className="object-cover"
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <h2 className="line-clamp-1 flex-1 text-sm font-semibold">
                    {game.title}
                  </h2>
                  {ownership.gifted_by && (
                    <Badge className="gap-1 border-brand-apricot/25 bg-brand-apricot/15 text-brand-apricot">
                      <Gift className="size-3" />
                      Gift
                    </Badge>
                  )}
                </div>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Added {formatDate(ownership.granted_at)}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  {/* Disabled with a reason rather than wired to nothing. The
                      download comes from the media service, which signs its own
                      URLs and is not part of the mock — a button that looked live
                      and did nothing would be the worst of the three options. */}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="sm"
                          disabled
                          className="min-h-9 flex-1 gap-1.5"
                        >
                          <Download className="size-3.5" />
                          Install
                        </Button>
                      }
                    />
                    <TooltipContent>
                      Downloads come from the media service, which is not
                      connected yet
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-9"
                    nativeButton={false}
                    render={<Link href={`/games/${game.id}`} />}
                  >
                    Details
                  </Button>
                  {refundable && order && <RefundButton order={order} />}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
