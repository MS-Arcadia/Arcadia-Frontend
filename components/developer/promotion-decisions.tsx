"use client"

import { Check, Loader2, Tag, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useDecidePromotionMutation,
  usePromotionsQuery,
} from "@/queries/workflow"
import { formatDate } from "@/lib/datetime"
import { isAwaitingDeveloper } from "@/lib/promotion"

interface Props {
  gameId: string
}

/**
 * Discounts Support has proposed, waiting on the developer.
 *
 * This is requirement 1.9's second half, and the reason it is a blocking decision
 * rather than a notification: the reduced price is still split 70/30, so a discount
 * costs the developer real money and cannot be applied to their game without them.
 */
export function PromotionDecisions({ gameId }: Props) {
  const { data } = usePromotionsQuery(gameId)
  const decide = useDecidePromotionMutation(gameId)

  const promotions = data?.items ?? []
  const waiting = promotions.filter((promotion) =>
    isAwaitingDeveloper(promotion.state)
  )
  const live = promotions.filter((promotion) => promotion.live)

  if (waiting.length === 0 && live.length === 0) return null

  return (
    <div className="space-y-2">
      {waiting.map((promotion) => (
        <div
          key={promotion.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/25 bg-warning/5 p-3"
        >
          <Tag className="size-4 shrink-0 text-warning" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">
              Support proposed {promotion.percent_off}% off
              {promotion.starts_at && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  from {formatDate(promotion.starts_at)} to{" "}
                  {formatDate(promotion.ends_at)}
                </span>
              )}
            </p>
            {promotion.note && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {promotion.note}
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              The reduced price is still shared 70/30, so this comes out of your
              revenue.
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="min-h-9"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({ promotionId: promotion.id, approve: true })
              }
            >
              {decide.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-9"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({ promotionId: promotion.id, approve: false })
              }
            >
              <X className="size-3.5" />
              Decline
            </Button>
          </div>
        </div>
      ))}

      {live.map((promotion) => (
        <Badge
          key={promotion.id}
          className="gap-1.5 border-primary/25 bg-primary/15 text-primary"
        >
          <Tag className="size-3" />
          {promotion.percent_off}% off until {formatDate(promotion.ends_at)}
        </Badge>
      ))}
    </div>
  )
}
