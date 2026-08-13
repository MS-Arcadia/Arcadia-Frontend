"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { GameCard } from "@/components/game/game-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useGamesQuery } from "@/queries/catalog"

/**
 * Real games on the landing page.
 *
 * The page described the platform well and showed nothing that was on it, which
 * for a storefront is the wrong way round: the fastest argument for a game shop
 * is a game. These are the same cards the catalogue uses, reading the same public
 * endpoint.
 *
 * The whole section disappears when there is nothing published rather than
 * rendering an empty rail — an empty shelf is a worse first impression than no
 * shelf.
 */
export function FeaturedGames() {
  const { data, isPending, isError } = useGamesQuery({ limit: 3 })
  const games = data?.items ?? []

  if (isError || (!isPending && games.length === 0)) return null

  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            On Arcadia right now
          </p>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Games you can buy today
          </h2>
        </div>
        <Button
          variant="outline"
          className="min-h-11 gap-1.5"
          nativeButton={false}
          render={<Link href="/browse" />}
        >
          See the whole catalogue
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isPending
          ? Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-72 w-full rounded-xl" />
            ))
          : games.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                priority={index === 0}
                basePath="/browse"
              />
            ))}
      </div>
    </section>
  )
}
