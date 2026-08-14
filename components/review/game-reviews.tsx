"use client"

import { useState } from "react"
import Link from "next/link"
import { MessageSquareText, ThumbsUp } from "lucide-react"

import { ReviewCard } from "@/components/review/review-card"
import { ReviewComposer } from "@/components/review/review-composer"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrdersQuery } from "@/queries/orders"
import { useAverageRatingQuery, useGameReviewsQuery } from "@/queries/reviews"
import { useAuthStore } from "@/stores/auth.store"
import { cn } from "@/lib/utils"
import type { ReviewSortBy } from "@/types/review.api.type"

interface Props {
  gameId: string
}

/** Requirement 1.7: anyone ever granted ownership may review — the buyer, a
 *  gift's recipient, even someone who has since refunded. `COMPLETED`,
 *  `REFUNDED`, `PAYING` and `DEFAULTED` all mean ownership was granted at some
 *  point; `PENDING`/`RESERVED`/`FAILED`/`REFUNDING`/`CANCELLED` do not. */
const EVER_OWNED_STATES = new Set([
  "COMPLETED",
  "REFUNDED",
  "PAYING",
  "DEFAULTED",
])

const SORTS: { value: ReviewSortBy; label: string }[] = [
  { value: "created_at", label: "Newest" },
  { value: "like_count", label: "Most liked" },
  { value: "dislike_count", label: "Most disliked" },
]

export function GameReviews({ gameId }: Props) {
  const userId = useAuthStore((state) => state.userId)
  const [sortBy, setSortBy] = useState<ReviewSortBy>("created_at")

  const { data: rating } = useAverageRatingQuery(gameId)
  const { data, isPending, isError } = useGameReviewsQuery(gameId, {
    sort_by: sortBy,
    sort_order: "desc",
    limit: 50,
  })
  const signedIn = userId !== null
  const { data: orders } = useOrdersQuery(signedIn)

  const everOwned = (orders?.items ?? []).some(
    (order) => order.game_id === gameId && EVER_OWNED_STATES.has(order.state)
  )
  const reviews = data?.reviews ?? []
  const alreadyReviewed = reviews.some((review) => review.author_id === userId)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareText className="size-4" strokeWidth={1.75} />
          Reviews
        </h2>
        {rating && rating.total_reviews > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ThumbsUp className="size-3" />
            {Math.round((rating.average_rating ?? 0) * 100)}% recommend ·{" "}
            <span className="tabular">{rating.total_reviews}</span>{" "}
            {rating.total_reviews === 1 ? "review" : "reviews"}
          </span>
        )}

        <div
          role="radiogroup"
          aria-label="Sort reviews"
          className="ms-auto flex items-center rounded-lg border border-border p-0.5"
        >
          {SORTS.map((option) => {
            const active = sortBy === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSortBy(option.value)}
                className={cn(
                  "min-h-8 rounded-md px-2.5 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {signedIn && everOwned && !alreadyReviewed && (
        <ReviewComposer gameId={gameId} />
      )}

      {!signedIn && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          Reviews are public. Writing one needs an account.
          <Button
            variant="link"
            className="h-auto min-h-0 p-0 text-sm"
            nativeButton={false}
            render={<Link href={`/sign-in?next=/games/${gameId}`} prefetch />}
          >
            Sign in to review
          </Button>
        </p>
      )}

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Reviews did not load. Reload the page to try again.
        </p>
      )}

      {!isPending && !isError && reviews.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <MessageSquareText
            className="mx-auto size-7 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-3 text-sm font-medium">No reviews yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {signedIn && everOwned
              ? "Be the first to say something about it."
              : "Reviews appear here once buyers write them."}
          </p>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              gameId={gameId}
              readOnly={!signedIn}
            />
          ))}
        </div>
      )}
    </section>
  )
}
