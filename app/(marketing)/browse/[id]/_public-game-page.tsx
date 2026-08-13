"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, CalendarClock, Monitor } from "lucide-react"

import { PriceTag } from "@/components/game/price-tag"
import { SimilarGamesRail } from "@/components/game/similar-games-rail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/datetime"
import { useGameQuery } from "@/queries/catalog"
import { gameArt } from "@/lib/game-art"

interface Props {
  id: string
}

/**
 * One game, for somebody who has not signed in.
 *
 * The signed-in page is the same content plus an acquire panel. Here the panel is
 * replaced by the reason to make an account, because buying genuinely needs one —
 * offering a button that bounces to a sign-in form would be worse than saying so.
 *
 * `/catalog/v1/games/{id}` is a public read and 404s for anything not on sale, so a
 * link to an unpublished title cannot confirm it exists.
 */
export function PublicGamePage({ id }: Props) {
  const { data: game, isPending, isError } = useGameQuery(id)

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-12 lg:px-10">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (isError || !game) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-6 py-20 text-center lg:px-10">
        <h1 className="font-display text-2xl font-bold">
          That game is not on sale
        </h1>
        <p className="text-muted-foreground">
          It may have been withdrawn, or it may never have been published.
        </p>
        <Button
          variant="outline"
          className="min-h-11"
          nativeButton={false}
          render={<Link href="/browse" />}
        >
          Back to the catalogue
        </Button>
      </div>
    )
  }

  const cover = gameArt(game.media)?.media_ref
  const preorder = game.state === "PREORDER"

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10 lg:px-10">
      <Button
        variant="ghost"
        size="sm"
        className="min-h-9 gap-1.5"
        nativeButton={false}
        render={<Link href="/browse" />}
      >
        <ArrowLeft className="size-4" />
        All games
      </Button>

      {cover && (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-muted">
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {preorder && (
                <Badge className="gap-1">
                  <CalendarClock className="size-3" />
                  Pre-order
                </Badge>
              )}
              {game.genres.map((genre) => (
                <Badge key={genre} variant="secondary">
                  {genre}
                </Badge>
              ))}
            </div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              {game.title}
            </h1>
          </div>

          <p className="whitespace-pre-line text-muted-foreground">
            {game.description}
          </p>

          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Monitor className="size-4" strokeWidth={1.75} />
              What you need to run it
            </h2>
            <p className="text-sm text-muted-foreground">
              {game.min_requirements}
            </p>
          </section>

          {game.published_at && (
            <p className="text-xs text-muted-foreground">
              Published {formatDate(game.published_at)}
            </p>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <PriceTag game={game} />
            <p className="text-sm text-muted-foreground">
              {preorder
                ? "Pre-order it with an account — the money is committed now and the game arrives at release."
                : "Buy it, gift it, or pay for it in instalments from an Arcadia wallet."}
            </p>
            <Button
              className="min-h-11 w-full"
              nativeButton={false}
              render={<Link href={`/sign-up?next=/games/${game.id}`} />}
            >
              Create an account
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 w-full"
              nativeButton={false}
              render={<Link href={`/sign-in?next=/games/${game.id}`} />}
            >
              I already have one
            </Button>
          </div>
        </aside>
      </div>

      <Separator />

      <SimilarGamesRail gameId={game.id} basePath="/browse" />
    </div>
  )
}
