"use client"

import { MediaImage } from "@/components/media-image"
import Link from "next/link"
import { CalendarClock, Check, Gift, Wallet } from "lucide-react"

import { PriceTag } from "@/components/game/price-tag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/datetime"
import { formatMoney, minorToMoney } from "@/lib/money"
import type { Game } from "@/types/catalog.api.type"
import { gameArt } from "@/lib/game-art"

interface Props {
  game: Game
  owned: boolean
}

const INSTALMENT_COUNT = 4

/**
 * The featured game, and the ways you can end up owning it.
 *
 * A storefront hero is normally cover art plus a Buy button. That would waste
 * the one thing this platform has that most stores do not: four genuinely
 * different routes to owning a game — pay now from the wallet, split it over
 * instalments and play immediately, reserve it before release, or buy it for
 * somebody else. Requirements 1.4, 1.5 and 3.3 are the product's actual
 * character, so they are what the hero is about.
 *
 * The instalment figure is computed here from the real price with integer
 * division, and the remainder is deliberately shown as "from" rather than hidden:
 * the last instalment carries the rounding, exactly as the order service builds
 * the schedule.
 */
export function StoreHero({ game, owned }: Props) {
  const art = gameArt(game.media)
  const price = game.effective_price ?? game.final_price
  const preorder = game.state === "PREORDER"

  const minor = price ? BigInt(price.amount_minor) : 0n
  const perInstalment = minor / BigInt(INSTALMENT_COUNT)
  const splittable = minor > 0n && !preorder && !owned

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {art && (
        <MediaImage
          src={art.media_ref}
          alt=""
          fill
          priority
          className="object-cover opacity-35"
        />
      )}
      {/* Reading the copy has to work whatever the art looks like, so a wash runs
          from the edge the text sits against. Gradient direction is physical, not
          logical — Tailwind has no `to-inline-end` — so this is the one thing in
          the app that would need flipping if the interface ever went RTL. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent"
      />

      <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-12">
        <div className="max-w-2xl space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {preorder ? (
              <Badge className="gap-1 border-brand-sky/25 bg-brand-sky/15 text-brand-sky">
                <CalendarClock className="size-3" />
                Pre-order — out {formatDate(game.release_at)}
              </Badge>
            ) : (
              <Badge className="border-primary/25 bg-primary/15 text-primary">
                {game.discount_bps > 0 ? "Featured deal" : "Editor\u2019s pick"}
              </Badge>
            )}
            {game.genres.slice(0, 2).map((genre) => (
              <span key={genre} className="text-xs text-muted-foreground">
                {genre}
              </span>
            ))}
          </div>

          <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">
            {game.title}
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {game.description}
          </p>

          <PriceTag game={game} size="lg" />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {owned ? (
              <Button
                size="lg"
                variant="secondary"
                className="min-h-11"
                nativeButton={false}
                render={<Link href="/library" />}
              >
                <Check className="size-4" />
                In your library
              </Button>
            ) : (
              <Button
                size="lg"
                className="min-h-11"
                nativeButton={false}
                render={<Link href={`/games/${game.id}`} />}
              >
                {preorder ? "Pre-order" : "Buy now"}
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="min-h-11"
              nativeButton={false}
              render={<Link href={`/games/${game.id}?intent=gift`} />}
            >
              <Gift className="size-4" />
              Send as a gift
            </Button>
          </div>
        </div>

        {/* The signature: the same game, priced three ways. This is the panel that
            says what kind of store this is. */}
        <dl className="h-fit divide-y divide-border rounded-xl border border-border bg-background/60 backdrop-blur-sm">
          <div className="flex items-start gap-3 p-4">
            <Wallet
              className="mt-0.5 size-4 shrink-0 text-brand-sky"
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <dt className="text-xs font-medium">Pay once</dt>
              <dd className="mt-0.5 text-xs text-muted-foreground tabular">
                {formatMoney(price)} from your wallet
              </dd>
            </div>
          </div>

          {splittable && (
            <div className="flex items-start gap-3 p-4">
              <span
                aria-hidden
                className="mt-0.5 w-4 shrink-0 text-center font-display text-[0.7rem] font-bold text-primary"
              >
                {INSTALMENT_COUNT}×
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-medium">Pay in instalments</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground tabular">
                  From{" "}
                  {formatMoney(
                    minorToMoney(perInstalment, price?.currency ?? "IRR")
                  )}{" "}
                  per payment. The game is yours from the first one.
                </dd>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-4">
            <Gift
              className="mt-0.5 size-4 shrink-0 text-brand-apricot"
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <dt className="text-xs font-medium">Gift with a message</dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                2% on top, for a note the recipient reads
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </section>
  )
}
