"use client"

import Link from "next/link"
import { Loader2, Receipt, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrdersQuery, useRefundMutation } from "@/queries/orders"
import { formatDateTime, timeUntil } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { OrderState, OrderType } from "@/types/order.api.type"

/**
 * State, in the words a buyer would use.
 *
 * The order service has ten states and every one of them means something
 * different to the person who paid — `PAYING` is not "in progress", it is "you
 * have the game and still owe for it", and `DEFAULTED` is not a failure, it is a
 * sale that ended badly. Flattening them into three would lose exactly the
 * information somebody opens this page to find.
 */
const STATE: Record<
  OrderState,
  { label: string; tone: "neutral" | "good" | "bad" | "warn" }
> = {
  PENDING: { label: "Processing", tone: "neutral" },
  RESERVED: { label: "Reserved", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "good" },
  FAILED: { label: "Failed", tone: "bad" },
  REFUNDING: { label: "Refunding", tone: "warn" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  PAYING: { label: "Paying in instalments", tone: "warn" },
  DEFAULTED: { label: "Defaulted", tone: "bad" },
}

const TYPE: Record<OrderType, string> = {
  PURCHASE: "Purchase",
  GIFT: "Gift",
  PREORDER: "Pre-order",
  INSTALMENT: "Payment plan",
}

const TONE = {
  neutral: "bg-muted text-muted-foreground border-border",
  good: "bg-brand-sky/15 text-brand-sky border-brand-sky/25",
  warn: "bg-warning/15 text-warning border-warning/25",
  bad: "bg-destructive/15 text-destructive border-destructive/25",
} as const

export default function OrdersPage() {
  const { data, isPending } = useOrdersQuery()
  const refund = useRefundMutation()
  const orders = data?.items ?? []

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Orders</h1>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isPending && orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Receipt
            className="mx-auto size-8 text-muted-foreground/40"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">No orders yet</p>
          <Button
            className="mt-5 min-h-11"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Browse the store
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {orders.map((order) => {
          const state = STATE[order.state]
          const left = timeUntil(order.refundable_until)
          const refundable = order.state === "COMPLETED" && left !== null

          return (
            <li
              key={order.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/games/${order.game_id}`}
                      className="text-sm font-semibold hover:text-primary"
                    >
                      {order.game_title}
                    </Link>
                    <Badge className={cn("shrink-0", TONE[state.tone])}>
                      {state.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {TYPE[order.type]}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(order.created_at)}
                  </p>

                  {order.gift && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Sent to{" "}
                      <span className="font-mono">
                        {order.gift.recipient_id}
                      </span>
                      {order.gift.message && ` — “${order.gift.message}”`}
                    </p>
                  )}

                  {order.failure_message && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {order.failure_message}
                    </p>
                  )}
                </div>

                <div className="text-end">
                  <p className="text-sm font-semibold tabular">
                    {formatMoney(order.total_charged)}
                  </p>
                  {refundable && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {left} to refund
                    </p>
                  )}
                </div>
              </div>

              {refundable && (
                <div className="mt-3 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9 gap-1.5"
                    disabled={refund.isPending}
                    onClick={() => refund.mutate(order.id)}
                  >
                    {refund.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Refund
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
