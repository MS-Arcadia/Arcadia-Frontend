"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, X } from "lucide-react"

import { GameCard } from "@/components/game/game-card"
import { usePrefetchHrefs } from "@/components/pwa/prefetch-public"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber } from "@/lib/money"
import { useGamesQuery } from "@/queries/catalog"

/**
 * The catalogue, without an account.
 *
 * Catalog's list and detail reads are public — deliberately, so a store page can
 * be linked and indexed — but every screen that showed them sat behind the signed-in
 * shell. A visitor could not see a single game before creating an account, which for
 * a storefront is the one page that has to work first.
 *
 * Nothing here is a second implementation: it is the same query and the same card the
 * signed-in store uses. What it does not do is own anything — no library, no wallet,
 * no acquire panel — because those genuinely need a session.
 */
export function BrowsePage() {
  const [search, setSearch] = useState("")
  const [genre, setGenre] = useState<string | null>(null)

  const { data, isPending, isError } = useGamesQuery({
    q: search || undefined,
    genre: genre ?? undefined,
    limit: 40,
  })

  const games = data?.items ?? []
  const genres = [...new Set(games.flatMap((game) => game.genres))].slice(0, 8)
  usePrefetchHrefs(games.map((game) => `/browse/${game.id}`))

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-12 lg:px-10">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Every game on Arcadia
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Browse the full catalogue. Create an account when you want to buy,
          gift, pre-order or pay in instalments.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or description"
            className="min-h-11 ps-9"
            aria-label="Search games"
          />
        </div>

        {genres.map((value) => (
          <Button
            key={value}
            variant={genre === value ? "default" : "outline"}
            size="sm"
            className="min-h-9"
            aria-pressed={genre === value}
            onClick={() => setGenre(genre === value ? null : value)}
          >
            {value}
          </Button>
        ))}

        {(search || genre) && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-9 gap-1.5"
            onClick={() => {
              setSearch("")
              setGenre(null)
            }}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {data && (
        <p className="text-sm text-muted-foreground tabular">
          {formatNumber(games.length)} {games.length === 1 ? "game" : "games"}
        </p>
      )}

      {isError ? (
        <p className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          The catalogue could not be loaded. It is worth trying again in a
          moment.
        </p>
      ) : isPending ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-border p-10 text-center">
          <p className="font-medium">Nothing matches that yet</p>
          <p className="text-sm text-muted-foreground">
            {search || genre
              ? "Try a different search, or clear the filters."
              : "Published games appear here as developers release them."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game, index) => (
            <GameCard
              key={game.id}
              game={game}
              priority={index < 3}
              basePath="/browse"
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-6">
        <div>
          <p className="font-medium">Ready to buy something?</p>
          <p className="text-sm text-muted-foreground">
            An account gets you a wallet, a library and instalment plans.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            Sign in
          </Button>
          <Button
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/sign-up" />}
          >
            Create an account
          </Button>
        </div>
      </div>
    </div>
  )
}
