"use client"

import { useState } from "react"
import Image from "next/image"
import { Check, ClipboardCheck, Loader2, Tag, X } from "lucide-react"

import { GameStateBadge } from "@/components/game/game-state-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useApproveGameMutation,
  useRejectGameMutation,
  useReviewQueueQuery,
  useStartReviewMutation,
  useSuggestPriceMutation,
} from "@/queries/workflow"
import { useHasRole } from "@/stores/auth.store"
import { formatRelative } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import type { Game } from "@/types/catalog.api.type"
import { gameArt } from "@/lib/game-art"

/**
 * Requirement 1.3 from Support's side.
 *
 * The queue holds everything waiting on a decision — submitted, being looked at,
 * and appealed. Appeals are shown in the same list rather than in a separate tab:
 * they are the same job, and splitting them is how one of them ends up unread.
 */
export default function ReviewPage() {
  const isStaff = useHasRole("SUPPORT", "ADMIN")
  const { data, isPending } = useReviewQueueQuery()
  const games = data?.items ?? []

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <ClipboardCheck
          className="mx-auto size-8 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden
        />
        <h1 className="mt-4 text-lg font-semibold">Support only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reviewing a submission is Support&apos;s job. A developer approving
          their own game would make the step decorative.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A decision here decides whether a game can be sold. A rejection has to
          say why — the developer can appeal it, and an unexplained rejection
          gives them nothing to answer.
        </p>
      </div>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isPending && games.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <ClipboardCheck
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">Nothing waiting</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Submissions appear here as developers send them.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {games.map((game) => (
          <ReviewCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  )
}

function ReviewCard({ game }: { game: Game }) {
  const start = useStartReviewMutation()
  const approve = useApproveGameMutation()
  const reject = useRejectGameMutation()
  const suggest = useSuggestPriceMutation()

  const [note, setNote] = useState("")
  const [price, setPrice] = useState("")

  const busy =
    start.isPending ||
    approve.isPending ||
    reject.isPending ||
    suggest.isPending
  const art = gameArt(game.media)
  const decidable = game.state === "IN_REVIEW"

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-4 p-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {art && (
            <Image
              src={art.media_ref}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{game.title}</h2>
            <GameStateBadge state={game.state} />
            <span className="text-xs text-muted-foreground">
              submitted {formatRelative(game.updated_at)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {game.description}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Build{" "}
            <span className="font-mono text-foreground">
              {game.versions.at(-1)?.version ?? "none"}
            </span>{" "}
            · {game.min_requirements}
          </p>
          {game.suggested_price && (
            <p className="text-xs text-muted-foreground">
              Suggested price{" "}
              <span className="text-foreground tabular">
                {formatMoney(game.suggested_price)}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border bg-background/40 p-4">
        {!decidable && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-xs text-muted-foreground">
              Pick it up before deciding, so two people do not review the same
              game at once.
            </p>
            <Button
              size="sm"
              className="min-h-9"
              disabled={busy}
              onClick={() => start.mutate(game.id)}
            >
              {start.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Start review
            </Button>
          </div>
        )}

        {decidable && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`note-${game.id}`} className="text-xs">
                Note to the developer
              </Label>
              <Input
                id={`note-${game.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Required for a rejection, optional for an approval"
                className="min-h-9"
              />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-28 space-y-1.5">
                <Label htmlFor={`suggest-${game.id}`} className="text-xs">
                  Suggest a price
                </Label>
                <Input
                  id={`suggest-${game.id}`}
                  inputMode="numeric"
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value.replace(/[^\d]/g, ""))
                  }
                  placeholder="550000"
                  className="min-h-9 tabular"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={busy || !price}
                onClick={() =>
                  suggest.mutate(
                    { gameId: game.id, amountMinor: Number(price) * 100 },
                    { onSuccess: () => setPrice("") }
                  )
                }
              >
                <Tag className="size-3.5" />
                Suggest
              </Button>

              <div className="ms-auto flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-h-9"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    reject.mutate({ gameId: game.id, note: note.trim() })
                  }
                >
                  {reject.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="min-h-9"
                  disabled={busy}
                  onClick={() =>
                    approve.mutate({ gameId: game.id, note: note.trim() })
                  }
                >
                  {approve.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Approve
                </Button>
              </div>
            </div>

            {!note.trim() && (
              <p className="text-xs text-muted-foreground/70">
                A rejection needs a note. Approving without one is allowed.
              </p>
            )}

            <p className="text-xs text-muted-foreground/70">
              A suggested price is advice, not a decision — the developer sets
              the real one.
            </p>
          </>
        )}
      </div>
    </article>
  )
}
