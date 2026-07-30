"use client"

import { BookOpen } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { useBookQuery } from "@/queries/marketplace"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { Money } from "@/types/common.api.type"
import type { BookDepth } from "@/types/marketplace.api.type"

interface Props {
  itemId: string
}

/**
 * Two columns, buys and sells, exactly as the API orders them — highest bid
 * first, lowest ask first — so the best price for each side sits at the top
 * next to the spread.
 */
export function OrderBook({ itemId }: Props) {
  const { data: book, isPending, isError } = useBookQuery(itemId)

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }, (_, column) => (
          <div key={column} className="space-y-2">
            {Array.from({ length: 4 }, (_, row) => (
              <Skeleton key={row} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (isError || !book) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        The order book did not load. Reload the page to try again.
      </p>
    )
  }

  const empty = book.buys.length === 0 && book.sells.length === 0

  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <BookOpen
          className="mx-auto size-8 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="mt-4 text-sm font-medium">No open orders yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Be the first to place a buy or sell order below.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <BookColumn
        label="Buys"
        tone="buy"
        rows={book.buys}
        best={book.best?.bid}
      />
      <BookColumn
        label="Sells"
        tone="sell"
        rows={book.sells}
        best={book.best?.ask}
      />
    </div>
  )
}

function BookColumn({
  label,
  tone,
  rows,
  best,
}: {
  label: string
  tone: "buy" | "sell"
  rows: BookDepth[]
  best?: Money
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span>Orders</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2.5 py-3 text-center text-xs text-muted-foreground">
          Nothing here
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => {
            const isBest = best && best.amount_minor === row.price.amount_minor
            return (
              <li
                key={row.price.amount_minor}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm",
                  isBest
                    ? tone === "buy"
                      ? "border-primary/40 bg-primary/10"
                      : "border-destructive/40 bg-destructive/10"
                    : "border-transparent bg-muted/40"
                )}
              >
                <span
                  className={cn(
                    "tabular font-medium",
                    tone === "buy" ? "text-primary" : "text-destructive"
                  )}
                >
                  {formatMoney(row.price)}
                </span>
                <span className="tabular text-xs text-muted-foreground">
                  {row.orders}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
