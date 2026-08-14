"use client"

import { useMemo, useState } from "react"
import { PartyPopper, Plus } from "lucide-react"

import { FestivalCard } from "@/components/festival/festival-card"
import { NewFestivalDialog } from "@/components/festival/new-festival-dialog"
import { usePrefetchHrefs } from "@/components/pwa/prefetch-public"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFestivalsQuery } from "@/queries/festivals"
import { useHasRole } from "@/stores/auth.store"
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
  usePrefetchHrefs(visible.map((festival) => `/festivals/${festival.id}`))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Festivals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide sales, running for a fixed window across every game an
            admin adds to them.
          </p>
        </div>
        {isAdmin && (
          <Button
            className="min-h-11 gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
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
      {draft.length > 0 && <FestivalSection title="Drafts" festivals={draft} />}
      {ended.length > 0 && <FestivalSection title="Ended" festivals={ended} />}
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
