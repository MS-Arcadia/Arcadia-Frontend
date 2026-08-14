"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Gamepad2, Plus } from "lucide-react"

import { DeveloperGameCard } from "@/components/developer/developer-game-card"
import { NewGameDialog } from "@/components/developer/new-game-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyGamesQuery } from "@/queries/workflow"
import { useHasRole } from "@/stores/auth.store"
import { formatNumber } from "@/lib/money"

/**
 * The developer's own catalogue, grouped by what it is waiting on.
 *
 * Ordered by *who has to act next* rather than alphabetically or by date, because
 * that is the question a developer opens this page with: what is on me, and what is
 * on Support. "Needs you" first, then "with Support", then everything that is
 * already selling.
 */
export default function DeveloperPage() {
  const isDeveloper = useHasRole("DEVELOPER")
  const { data, isPending } = useMyGamesQuery()
  const [creating, setCreating] = useState(false)

  // `?game=` comes from a notification — "20% off X is waiting for your approval". The
  // decision lives on this page, so the link brings them here and this puts them in
  // front of the right card instead of the top of a list.
  const focused = useSearchParams().get("game")
  useEffect(() => {
    if (!focused || isPending) return
    document
      .getElementById(`game-${focused}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focused, isPending])

  const games = data?.items ?? []
  const needsYou = games.filter(
    (game) =>
      game.state === "DRAFT" ||
      game.state === "APPROVED" ||
      game.state === "PRICED" ||
      game.state === "REJECTED"
  )
  const withSupport = games.filter(
    (game) =>
      game.state === "SUBMITTED" ||
      game.state === "IN_REVIEW" ||
      game.state === "APPEALED"
  )
  const selling = games.filter(
    (game) => game.state === "PUBLISHED" || game.state === "PREORDER"
  )

  if (!isDeveloper) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <Gamepad2
          className="mx-auto size-8 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden
        />
        <h1 className="mt-4 text-lg font-semibold">Developers only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask to become a developer from the account menu. An administrator
          decides.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">My games</h1>
        {data && (
          <span className="text-sm text-muted-foreground tabular">
            {formatNumber(games.length)}
          </span>
        )}
        <Button className="ms-auto min-h-11" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Register a game
        </Button>
      </div>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isPending && games.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Gamepad2
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Register a game, upload a build, and send it for review. Support
            decides whether it can go on sale; you decide what it costs.
          </p>
        </div>
      )}

      <Section title="Needs you" games={needsYou} />
      <Section
        title="With Support"
        description="Waiting on a review decision. Nothing for you to do until it comes back."
        games={withSupport}
      />
      <Section title="On sale" games={selling} />

      <NewGameDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function Section({
  title,
  description,
  games,
}: {
  title: string
  description?: string
  games: React.ComponentProps<typeof DeveloperGameCard>["game"][]
}) {
  if (games.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-3">
        {games.map((game) => (
          <DeveloperGameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  )
}
