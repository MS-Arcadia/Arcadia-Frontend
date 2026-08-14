"use client"

import { useState } from "react"
import {
  Flag,
  Loader2,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  useDeleteReviewMutation,
  useEditReviewMutation,
  useReactToReviewMutation,
  useReportReviewMutation,
} from "@/queries/reviews"
import { useAuthStore } from "@/stores/auth.store"
import { formatRelative } from "@/lib/datetime"
import { cn } from "@/lib/utils"
import { MAX_REVIEW_WORDS, type Review } from "@/types/review.api.type"

interface Props {
  review: Review
  gameId: string
  /** Signed-out visitors can read a review, not like, report or edit it. */
  readOnly?: boolean
}

/** Requirement 1.7's max is 1000 *words*, not characters — see MAX_REVIEW_WORDS. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function ReviewCard({ review, gameId, readOnly = false }: Props) {
  const userId = useAuthStore((state) => state.userId)
  const isAuthor = !readOnly && userId === review.author_id

  const react = useReactToReviewMutation(gameId)
  const edit = useEditReviewMutation(gameId)
  const del = useDeleteReviewMutation(gameId)
  const report = useReportReviewMutation()

  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(review.text)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState("")

  const words = wordCount(text)
  const overLimit = words > MAX_REVIEW_WORDS

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                review.sentiment === "LIKE"
                  ? "border-primary/25 bg-primary/15 text-primary"
                  : "border-destructive/25 bg-destructive/15 text-destructive"
              )}
            >
              {review.sentiment === "LIKE" ? (
                <ThumbsUp className="size-3" />
              ) : (
                <ThumbsDown className="size-3" />
              )}
              {review.sentiment === "LIKE"
                ? "Recommends"
                : "Does not recommend"}
            </span>
            <span className="font-mono text-xs text-muted-foreground/70">
              {review.author_id.slice(0, 8)}
            </span>
            <span className="text-xs text-muted-foreground/70">
              {formatRelative(review.created_at)}
              {review.status === "EDITED" && " · edited"}
            </span>
          </div>
        </div>

        {readOnly ? null : isAuthor ? (
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={editing ? "Cancel editing" : "Edit review"}
              onClick={() => {
                setEditing((prev) => !prev)
                setText(review.text)
              }}
            >
              {editing ? (
                <X className="size-3.5" />
              ) : (
                <Pencil className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete review"
              disabled={del.isPending}
              onClick={() => del.mutate(review.id)}
            >
              {del.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Report review"
            onClick={() => setReporting((prev) => !prev)}
          >
            <Flag className="size-3.5" />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={overLimit}
          />
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "text-xs tabular",
                overLimit ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {words} / {MAX_REVIEW_WORDS} words
            </p>
            <Button
              size="sm"
              className="min-h-9"
              disabled={edit.isPending || overLimit || !text.trim()}
              onClick={() =>
                edit.mutate(
                  { reviewId: review.id, body: { text: text.trim() } },
                  { onSuccess: () => setEditing(false) }
                )
              }
            >
              {edit.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {review.text}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        {readOnly ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ThumbsUp className="size-3.5" />
              <span className="tabular">{review.like_count}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ThumbsDown className="size-3.5" />
              <span className="tabular">{review.dislike_count}</span>
            </span>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="min-h-8 gap-1.5"
              disabled={isAuthor || react.isPending}
              onClick={() =>
                react.mutate({ reviewId: review.id, reactionType: "LIKE" })
              }
            >
              <ThumbsUp className="size-3.5" />
              <span className="tabular">{review.like_count}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-8 gap-1.5"
              disabled={isAuthor || react.isPending}
              onClick={() =>
                react.mutate({
                  reviewId: review.id,
                  reactionType: "DISLIKE",
                })
              }
            >
              <ThumbsDown className="size-3.5" />
              <span className="tabular">{review.dislike_count}</span>
            </Button>
          </>
        )}
      </div>

      {reporting && (
        <div className="space-y-2 rounded-lg border border-warning/25 bg-warning/5 p-3">
          <Textarea
            rows={2}
            placeholder="Why does this review break the rules?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-8"
              onClick={() => setReporting(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="min-h-8"
              disabled={report.isPending || reason.trim().length < 3}
              onClick={() =>
                report.mutate(
                  { reviewId: review.id, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      setReporting(false)
                      setReason("")
                    },
                  }
                )
              }
            >
              {report.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Report to Support
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}
