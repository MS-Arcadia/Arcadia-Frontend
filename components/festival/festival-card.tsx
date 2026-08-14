"use client"

import Link from "next/link"
import { CalendarDays, Gamepad2 } from "lucide-react"

import { FestivalStateBadge } from "@/components/festival/festival-state-badge"
import { formatDate, timeUntil } from "@/lib/datetime"
import { formatNumber } from "@/lib/money"
import type { FestivalView } from "@/types/festival.api.type"

export function FestivalCard({ festival }: { festival: FestivalView }) {
  const endsIn =
    festival.state === "ACTIVE" ? timeUntil(festival.ends_at) : null
  const startsIn =
    festival.state === "DRAFT" ? timeUntil(festival.starts_at) : null

  return (
    <Link
      href={`/festivals/${festival.id}`}
      prefetch
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
