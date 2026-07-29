"use client"

import { useMemo } from "react"
import { SlidersHorizontal, X } from "lucide-react"

import { GameCard } from "@/components/game/game-card"
import { StoreHero } from "@/components/game/store-hero"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useGamesQuery, useLibraryQuery } from "@/queries/catalog"
import { formatNumber } from "@/lib/money"
import { useStoreFilters } from "@/stores/store-filters.store"
import { cn } from "@/lib/utils"

export function StorePage() {
  const {
    search,
    genre,
    sort,
    onlyDiscounted,
    setGenre,
    setSort,
    toggleDiscounted,
    reset,
  } = useStoreFilters()

  const { data, isPending, isError } = useGamesQuery({
    q: search || undefined,
    genre: genre ?? undefined,
    sort,
    limit: 40,
  })
  const { data: library } = useLibraryQuery()

  const owned = useMemo(
    () => new Set((library?.items ?? []).map((entry) => entry.game.id)),
    [library]
  )

  const games = useMemo(() => {
    const all = data?.items ?? []
    return onlyDiscounted ? all.filter((game) => game.discount_bps > 0) : all
  }, [data, onlyDiscounted])

  const genres = useMemo(() => {
    const seen = new Set<string>()
    for (const game of data?.items ?? [])
      for (const g of game.genres) seen.add(g)
    return [...seen]
  }, [data])

  const featured = games.find((game) => game.discount_bps > 0) ?? games[0]
  const filtered = Boolean(search || genre || onlyDiscounted)

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-10">
      {/* The hero is skipped entirely while filtering: somebody who has typed a
          search wants results, not a billboard pushing them below the fold. */}
      {!filtered && featured && (
        <StoreHero game={featured} owned={owned.has(featured.id)} />
      )}

      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">
            {search ? `Results for \u201C${search}\u201D` : "All games"}
          </h2>
          {data && (
            <span className="text-sm text-muted-foreground tabular">
              {formatNumber(games.length)} games
            </span>
          )}

          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Button
              variant={onlyDiscounted ? "default" : "outline"}
              size="sm"
              onClick={toggleDiscounted}
              className="min-h-9"
            >
              <SlidersHorizontal className="size-3.5" />
              On sale
            </Button>

            {(["newest", "price-asc", "discount"] as const).map((option) => (
              <Button
                key={option}
                variant={sort === option ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSort(option)}
                className="min-h-9"
              >
                {option === "newest" && "Newest"}
                {option === "price-asc" && "Cheapest"}
                {option === "discount" && "Biggest discount"}
              </Button>
            ))}
          </div>
        </div>

        {genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {genres.map((item) => {
              const active = genre === item
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGenre(active ? null : item)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-8 rounded-full border px-3 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                  )}
                >
                  {item}
                </button>
              )
            })}

            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="min-h-8 gap-1"
              >
                <X className="size-3.5" />
                Clear filters
              </Button>
            )}
          </div>
        )}

        {isPending && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="aspect-[16/10] w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            The catalogue did not load. Reload the page to try again.
          </p>
        )}

        {!isPending && !isError && games.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-sm">No games match these filters.</p>
            <Button variant="link" size="sm" onClick={reset} className="mt-1">
              Clear them
            </Button>
          </div>
        )}

        {games.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                owned={owned.has(game.id)}
                priority={index < 4}
              />
            ))}
          </div>
        )}
      </section>

      {data && data.total > games.length && (
        <p className="text-center text-xs text-muted-foreground">
          <Badge variant="secondary" className="tabular">
            {formatNumber(games.length)} of {formatNumber(data.total)}
          </Badge>
        </p>
      )}
    </div>
  )
}
