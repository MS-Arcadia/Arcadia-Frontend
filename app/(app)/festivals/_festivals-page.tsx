"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, Gamepad2, PartyPopper, Plus } from "lucide-react"

import { FestivalStateBadge } from "@/components/festival/festival-state-badge"
import { NewFestivalDialog } from "@/components/festival/new-festival-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFestivalsQuery } from "@/queries/festivals"
import { useHasRole } from "@/stores/auth.store"
import { formatDate, timeUntil } from "@/lib/datetime"
import { formatNumber } from "@/lib/money"
import type { FestivalView } from "@/types/festival.api.type"

/**
 * Requirement 1.9's storefront face. Public: anyone can browse festivals, but
 * a DRAFT is an admin's own pipeline and a CANCELLED one never happened as
 * far as a shopper is concerned — both are hidden entirely rather than
 * merely badged, the same way `catalog.games` never lists an unpublished
 * game to a normal shopper.
 */
export function FestivalsPage() {
  const isAdmin = useHasRole("ADMIN")
  const [createOpen, setCreateOpen] = useState(false)
  const { data, isPending, isError } = useFestivalsQuery({ limit: 60 })

  const visible = useMemo(() => {
    const festivals = data?.items ?? []
    return isAdmin
      ? festivals
      : festivals.filter(
          (festival) =>
            festival.state === "ACTIVE" || festival.state === "ENDED"
        )
  }, [data, isAdmin])

  const active = visible.filter((festival) => festival.state === "ACTIVE")
  const draft = visible.filter((festival) => festival.state === "DRAFT")
  const ended = visible.filter((festival) => festival.state === "ENDED")
  const cancelled = visible.filter((festival) => festival.state === "CANCELLED")

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Festivals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide sales, running for a fixed window across every game
            an admin adds to them.
          </p>
        </div>
        {isAdmin && (
          <Button className="min-h-11 gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New festival
          </Button>
        )}
      </div>

      {isAdmin && (
        <NewFestivalDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Festivals did not load. Reload the page to try again.
        </p>
      )}

      {!isPending && !isError && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <PartyPopper
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">Nothing running</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Create a festival to run a platform-wide sale."
              : "Check back once an admin starts one — everyone is notified."}
          </p>
        </div>
      )}

      {active.length > 0 && (
        <FestivalSection title="Live now" festivals={active} />
      )}
      {draft.length > 0 && (
        <FestivalSection title="Drafts" festivals={draft} />
      )}
      {ended.length > 0 && (
        <FestivalSection title="Ended" festivals={ended} />
      )}
      {cancelled.length > 0 && (
        <FestivalSection title="Cancelled" festivals={cancelled} />
      )}
    </div>
  )
}

function FestivalSection({
  title,
  festivals,
}: {
  title: string
  festivals: FestivalView[]
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {festivals.map((festival) => (
          <FestivalCard key={festival.id} festival={festival} />
        ))}
      </div>
    </section>
  )
}

function FestivalCard({ festival }: { festival: FestivalView }) {
  const endsIn = festival.state === "ACTIVE" ? timeUntil(festival.ends_at) : null
  const startsIn = festival.state === "DRAFT" ? timeUntil(festival.starts_at) : null

  return (
    <Link
      href={`/festivals/${festival.id}`}
      className="flex flex-col rounded-xl border border-border bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{festival.name}</h3>
        <FestivalStateBadge state={festival.state} />
      </div>

      {festival.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {festival.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3.5" strokeWidth={1.75} />
          {formatDate(festival.starts_at)} – {formatDate(festival.ends_at)}
        </span>
        <span className="flex items-center gap-1 tabular">
          <Gamepad2 className="size-3.5" strokeWidth={1.75} />
          {formatNumber(festival.game_count)}{" "}
          {festival.game_count === 1 ? "game" : "games"}
        </span>
      </div>

      {endsIn && (
        <p className="mt-2 text-xs font-medium text-primary">
          Ends in {endsIn}
        </p>
      )}
      {startsIn && (
        <p className="mt-2 text-xs text-muted-foreground">
          Starts in {startsIn}
        </p>
      )}
    </Link>
  )
}
