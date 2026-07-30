"use client"

import { useState } from "react"
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useCreateReviewMutation } from "@/queries/reviews"
import { cn } from "@/lib/utils"
import { MAX_REVIEW_WORDS, type ReviewSentiment } from "@/types/review.api.type"

interface Props {
  gameId: string
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function ReviewComposer({ gameId }: Props) {
  const create = useCreateReviewMutation(gameId)
  const [sentiment, setSentiment] = useState<ReviewSentiment>("LIKE")
  const [text, setText] = useState("")

  const words = wordCount(text)
  const overLimit = words > MAX_REVIEW_WORDS

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">Write a review</p>

      <div
        role="radiogroup"
        aria-label="Recommend this game"
        className="flex items-center gap-2"
      >
        <button
          type="button"
          role="radio"
          aria-checked={sentiment === "LIKE"}
          onClick={() => setSentiment("LIKE")}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
            sentiment === "LIKE"
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <ThumbsUp className="size-3.5" />
          Recommended
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={sentiment === "DISLIKE"}
          onClick={() => setSentiment("DISLIKE")}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
            sentiment === "DISLIKE"
              ? "border-destructive/40 bg-destructive/15 text-destructive"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <ThumbsDown className="size-3.5" />
          Not recommended
        </button>
      </div>

      <Textarea
        rows={4}
        placeholder="What should another buyer know before picking this up?"
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
          disabled={create.isPending || overLimit || !text.trim()}
          onClick={() =>
            create.mutate(
              { text: text.trim(), sentiment },
              { onSuccess: () => setText("") }
            )
          }
        >
          {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Post review
        </Button>
      </div>
    </div>
  )
}
