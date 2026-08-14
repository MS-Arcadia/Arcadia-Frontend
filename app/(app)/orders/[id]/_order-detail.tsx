"use client"

import Link from "next/link"
import { ArrowLeft, Check, Clock, Loader2, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useMeQuery } from "@/queries/auth"
import {
  useInstalmentPlanQuery,
  useOrderQuery,
  usePayNextInstalmentMutation,
  useRefundMutation,
} from "@/queries/orders"
import { formatDate, formatDateTime, timeUntil } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import { isReceivedGift } from "@/lib/order-gift"
import { cn } from "@/lib/utils"
import type { InstalmentState } from "@/types/order.api.type"

const INSTALMENT_TONE: Record<InstalmentState, string> = {
  PAID: "bg-primary/15 text-primary border-primary/25",
  DUE: "bg-warning/15 text-warning border-warning/25",
  SCHEDULED: "bg-muted text-muted-foreground border-border",
  MISSED: "bg-destructive/15 text-destructive border-destructive/25",
}

export function OrderDetail({ id }: { id: string }) {
  const { data: me } = useMeQuery()
  const { data: order, isPending, isError } = useOrderQuery(id)
  const isPlan = order?.type === "INSTALMENT"
  const { data: plan } = useInstalmentPlanQuery(isPlan ? id : "")
  const refund = useRefundMutation()
  const payNext = usePayNextInstalmentMutation()

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-lg font-semibold">No such order</h1>
        <Button
          variant="outline"
          className="mt-5 min-h-11"
          nativeButton={false}
          render={<Link href="/orders" />}
        >
          Back to orders
        </Button>
      </div>
    )
  }

  const left = timeUntil(order.refundable_until)
  const refundable = order.state === "COMPLETED" && left !== null
  const nextDue = plan?.instalments.find((item) => item.state !== "PAID")
  const received = isReceivedGift(order, me?.user_id)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ms-2 gap-1.5"
        nativeButton={false}
        render={<Link href="/orders" />}
      >
        <ArrowLeft className="size-4" />
        Orders
      </Button>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{order.game_title}</h1>
        <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
      </div>

      {/* The money, itemised. The 70/30 split is shown because it is not a secret
          and it explains where a refund has to come back from. */}
      <dl className="divide-y divide-border rounded-xl border border-border text-sm">
        <Row
          label={received ? "Charged to sender" : "Charged"}
          value={formatMoney(order.total_charged)}
          strong
        />
        <Row label="List price" value={formatMoney(order.base_price)} />
        {order.discount && (
          <Row
            label={`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`}
            value={`− ${formatMoney(order.discount)}`}
          />
        )}
        {order.gift?.message_fee && (
          <Row
            label="Gift message"
            value={formatMoney(order.gift.message_fee)}
          />
        )}
        <Row
          label="Developer's share"
          value={formatMoney(order.developer_share)}
        />
        <Row
          label="Platform's share"
          value={formatMoney(order.platform_share)}
        />
        <Row label="Placed" value={formatDateTime(order.created_at)} />
        {order.completed_at && (
          <Row label="Completed" value={formatDateTime(order.completed_at)} />
        )}
        {order.refunded_at && (
          <Row label="Refunded" value={formatDateTime(order.refunded_at)} />
        )}
      </dl>

      {order.gift && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">
            {received ? "Received as a gift" : "Sent as a gift"}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {received ? order.buyer_id : order.gift.recipient_id}
          </p>
          {order.gift.message && (
            <p className="mt-2 text-sm text-muted-foreground italic">
              &ldquo;{order.gift.message}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* --- the instalment schedule ------------------------------------- */}
      {plan && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-sm font-semibold">Payment plan</h2>
            <span className="text-xs text-muted-foreground tabular">
              {formatMoney(plan.paid)} of {formatMoney(plan.total)} paid
            </span>
            {plan.defaults_at && plan.state === "PAYING" && (
              <span className="ms-auto text-xs text-warning">
                Defaults {formatDate(plan.defaults_at)}
              </span>
            )}
          </div>

          <ol className="divide-y divide-border rounded-xl border border-border">
            {plan.instalments.map((item) => (
              <li key={item.number} className="flex items-center gap-3 p-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    item.state === "PAID"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.state === "PAID" ? (
                    <Check className="size-3.5" />
                  ) : (
                    item.number
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    Payment {item.number} of {item.of_total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.state === "PAID"
                      ? `Taken ${formatDate(item.paid_at)}`
                      : `Due ${formatDate(item.due_at)}`}
                  </p>
                </div>

                <span className="text-sm tabular">
                  {formatMoney(item.amount)}
                </span>
                <Badge className={cn("shrink-0", INSTALMENT_TONE[item.state])}>
                  {item.state}
                </Badge>
              </li>
            ))}
          </ol>

          <p className="text-xs leading-relaxed text-warning/90">
            Missing a payment for longer than the {plan.grace_days}-day grace
            period removes the game. What has already been paid is not returned
            — this is the one place on the platform where access is taken away
            without a refund.
          </p>

          {nextDue && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                className="min-h-11"
                disabled={payNext.isPending}
                onClick={() => payNext.mutate(order.id)}
              >
                {payNext.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Clock className="size-4" />
                )}
                Pay {formatMoney(nextDue.amount)} now
              </Button>
              <p className="text-xs text-muted-foreground/70">
                The real service collects on a schedule and has no endpoint for
                this — paying early exists here so the flow can be seen without
                waiting a month.
              </p>
            </div>
          )}
        </section>
      )}

      {refundable && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {left} left to change your mind
            </p>
            <p className="text-xs text-muted-foreground">
              A refund puts the money back and removes the game from your
              library.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={refund.isPending}
            onClick={() => refund.mutate(order.id)}
          >
            {refund.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Refund
          </Button>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm tabular", strong && "font-semibold")}>
        {value}
      </dd>
    </div>
  )
}
