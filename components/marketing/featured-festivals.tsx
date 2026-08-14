"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { FestivalCard } from "@/components/festival/festival-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFestivalsQuery } from "@/queries/festivals"

/**
 * Live festivals on the landing page.
 *
 * The catalogue already shows games; this is the other public thing a visitor
 * should see before they have an account — a sale running now, not a description
 * of what a festival is.
 */
export function FeaturedFestivals() {
  const { data, isPending, isError } = useFestivalsQuery({ limit: 6 })
  const festivals = (data?.items ?? []).filter(
    (festival) => festival.state === "ACTIVE"
  )

  if (isError || (!isPending && festivals.length === 0)) return null

  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            On sale this week
          </p>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Festivals running now
          </h2>
        </div>
        <Button
          variant="outline"
          className="min-h-11 gap-1.5"
          nativeButton={false}
          render={<Link href="/festivals" prefetch />}
        >
          All festivals
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isPending
          ? Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-xl" />
            ))
          : festivals.map((festival) => (
              <FestivalCard key={festival.id} festival={festival} />
            ))}
      </div>
    </section>
  )
}
