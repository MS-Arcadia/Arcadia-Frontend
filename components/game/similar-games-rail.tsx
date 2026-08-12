"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSimilarGamesQuery } from "@/queries/recommendations"

/** Public — content-based, so it renders the same for a signed-out visitor. */
export function SimilarGamesRail({ gameId }: { gameId: string }) {
  const { data, isPending, isError } = useSimilarGamesQuery(gameId, 6)

  if (isError) return null
  if (!isPending && data?.items.length === 0) return null

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">More like this</h2>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {isPending
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-56 shrink-0 rounded-xl" />
            ))
          : data?.items.map((item) => (
              <Link
                key={item.game_id}
                href={`/games/${item.game_id}`}
                className="shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-28 w-56 justify-center p-4 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/20">
                  <p className="line-clamp-1 font-medium">{item.title}</p>
                  <div className="flex flex-wrap gap-1">
                    {item.genres.slice(0, 2).map((genre) => (
                      <Badge
                        key={genre}
                        variant="secondary"
                        className="text-xs"
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
      </div>
    </section>
  )
}
