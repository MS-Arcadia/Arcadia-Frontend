"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyRecommendationsQuery } from "@/queries/recommendations"

/** Requirements §3.1. Reads honestly: `source: "FALLBACK"` means the platform has
 *  no taste signal for this user yet, so the heading says "popular right now"
 *  rather than claiming a personalisation it didn't do. */
export function RecommendedRail() {
  const { data, isPending, isError } = useMyRecommendationsQuery(8)

  if (isError) return null
  if (!isPending && data?.items.length === 0) return null

  const personalised = data?.source !== "FALLBACK" && data?.source !== undefined

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">
          {personalised ? "Recommended for you" : "Popular right now"}
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {isPending
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-64 shrink-0 rounded-xl" />
            ))
          : data?.items.map((item) => (
              <Link
                key={item.game_id}
                href={`/games/${item.game_id}`}
                className="shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-32 w-64 justify-between p-4 ring-1 ring-foreground/10 transition-colors hover:ring-foreground/20">
                  <div className="space-y-1.5">
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
                  </div>
                  {item.reasons[0] && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {item.reasons[0]}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
      </div>
    </section>
  )
}
