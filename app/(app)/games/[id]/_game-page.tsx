"use client"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarClock, Monitor } from "lucide-react"

import { AcquirePanel } from "@/components/game/acquire-panel"
import { PriceTag } from "@/components/game/price-tag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useGameQuery, useLibraryQuery } from "@/queries/catalog"
import { formatDate } from "@/lib/datetime"

interface Props {
  id: string
}

export function GamePage({ id }: Props) {
  const params = useSearchParams()
  const { data: game, isPending, isError } = useGameQuery(id)
  const { data: library } = useLibraryQuery()

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !game) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-lg font-semibold">No such game</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been withdrawn from sale.
        </p>
        <Button
          variant="outline"
          className="mt-5 min-h-11"
          nativeButton={false}
          render={<Link href="/store" />}
        >
          Back to the store
        </Button>
      </div>
    )
  }

  const art = game.media.find((item) => item.kind === "COVER") ?? game.media[0]
  const owned = (library?.items ?? []).some(
    (entry) => entry.game.id === game.id
  )
  const preorder = game.state === "PREORDER"

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ms-2 gap-1.5"
        nativeButton={false}
        render={<Link href="/store" />}
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        Store
      </Button>

      {/* A fixed height rather than an aspect ratio: 21:9 across a 1440px window is
          over 500px of artwork, which pushes the price and the buy panel below the
          fold on the one page where they are the point. `object-cover` crops the
          art instead of letting the ratio dictate the layout. */}
      <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-border bg-card sm:h-72 lg:h-80">
        {art && (
          <Image
            src={art.media_ref}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-card to-transparent"
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {preorder && (
                <Badge className="gap-1 border-brand-sky/25 bg-brand-sky/15 text-brand-sky">
                  <CalendarClock className="size-3" />
                  Out {formatDate(game.release_at)}
                </Badge>
              )}
              {game.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {genre}
                </span>
              ))}
            </div>

            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              {game.title}
            </h1>
            <PriceTag game={game} size="lg" />
          </div>

          <p className="max-w-2xl leading-relaxed text-muted-foreground">
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

          {game.versions.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Latest build</h2>
              <dl className="grid grid-cols-2 gap-y-1 text-sm text-muted-foreground sm:max-w-sm">
                <dt>Version</dt>
                <dd className="font-mono text-xs text-foreground tabular">
                  {game.versions.at(-1)?.version}
                </dd>
                <dt>Published</dt>
                <dd className="text-foreground">
                  {formatDate(game.published_at)}
                </dd>
              </dl>
            </section>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <AcquirePanel
            game={game}
            owned={owned}
            defaultIntent={params.get("intent") ?? undefined}
          />
        </div>
      </div>
    </div>
  )
}
