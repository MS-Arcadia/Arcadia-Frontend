import { Badge } from "@/components/ui/badge"
import { formatMoney, isFree, percentOff } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { Game } from "@/types/catalog.api.type"

interface Props {
  game: Game
  className?: string
  size?: "sm" | "lg"
}

/**
 * A price, and the discount that produced it.
 *
 * `effective_price` and `final_price` are separate fields on purpose — the
 * catalog computes the discount server-side so nothing reimplements the
 * arithmetic — and this is the one place that renders both, struck through.
 *
 * "رایگان" rather than "۰ ریال": a 10000 bps promotion makes a game free, and a
 * zero price reads like a loading state.
 */
export function PriceTag({ game, className, size = "sm" }: Props) {
  const effective = game.effective_price ?? game.final_price
  const discounted = game.discount_bps > 0 && game.final_price !== null

  if (isFree(effective)) {
    return (
      <span
        className={cn(
          "font-medium text-brand-sky",
          size === "lg" ? "text-xl" : "text-sm",
          className
        )}
      >
        Free
      </span>
    )
  }

  return (
    // `flex-wrap` with `whitespace-nowrap` on each part: on a narrow phone the
    // row has to break somewhere, and it should break *between* the two prices
    // rather than through the middle of one — "360,000" on one line and "IRR" on
    // the next reads as a broken layout.
    <span
      className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}
    >
      {discounted && (
        <Badge className="border-primary/25 bg-primary/15 px-1.5 text-[0.7rem] whitespace-nowrap text-primary tabular">
          {/* "25% off" rather than "−25%": the word says which direction the
              number goes, and a bare minus next to a percentage reads as a range. */}
          {percentOff(game.discount_bps)}% off
        </Badge>
      )}
      <span
        className={cn(
          "font-medium whitespace-nowrap tabular",
          size === "lg" ? "text-xl sm:text-2xl" : "text-sm",
          discounted && "text-primary"
        )}
      >
        {formatMoney(effective)}
      </span>
      {discounted && (
        <span
          className={cn(
            "whitespace-nowrap text-muted-foreground/70 tabular line-through",
            size === "lg" ? "text-base" : "text-xs"
          )}
        >
          {formatMoney(game.final_price)}
        </span>
      )}
    </span>
  )
}
