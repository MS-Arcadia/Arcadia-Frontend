"use client"

import Image from "next/image"
import Link from "next/link"
import { Download, Gift, LibraryBig } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLibraryQuery } from "@/queries/catalog"
import { formatDate } from "@/lib/datetime"
import { formatNumber } from "@/lib/money"
import { gameArt } from "@/lib/game-art"

export default function LibraryPage() {
  const { data, isPending } = useLibraryQuery()
  const entries = data?.items ?? []

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
        {entries.map(({ game, ownership }) => {
          const art = gameArt(game.media)
          return (
            <article
              key={ownership.id}
              className="flex gap-4 overflow-hidden rounded-xl border border-border bg-card p-3"
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {art && (
                  <Image
                    src={art.media_ref}
                    alt=""
                    fill
                    sizes="80px"
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

                <div className="mt-auto flex items-center gap-2 pt-2">
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
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
