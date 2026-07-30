"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Loader2,
  Package,
  PlayCircle,
  Plus,
  Receipt,
  ScrollText,
  X,
} from "lucide-react"

import { ItemCard } from "@/components/marketplace/item-card"
import { NewItemDialog } from "@/components/marketplace/new-item-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useCancelMarketOrderMutation,
  useHoldingsQuery,
  useItemsQuery,
  useMyOrdersQuery,
  useMyTradesQuery,
  useRunMatchingMutation,
} from "@/queries/marketplace"
import { useAuthStore, useHasRole } from "@/stores/auth.store"
import { formatDateTime, formatRelative } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type {
  MarketOrder,
  MarketOrderStatus,
} from "@/types/marketplace.api.type"

/**
 * The marketplace screen for requirement 1.6: browse listed items, place and
 * cancel orders, see trades once they match, and see what you hold. Staff get
 * one extra control — running the matching pass early — and developers get
 * the button that starts the whole thing, listing an item in the first place.
 */
export function MarketPage() {
  const isDeveloper = useHasRole("DEVELOPER", "ADMIN")
  const isStaff = useHasRole("SUPPORT", "ADMIN")
  const [dialogOpen, setDialogOpen] = useState(false)
  const runMatching = useRunMatchingMutation()

  const { data, isPending, isError } = useItemsQuery({ limit: 40 })
  const items = data?.items ?? []

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Market</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            In-game items developers hand out, traded through an order book that
            matches buyers and sellers automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                disabled={runMatching.isPending}
                onClick={() => runMatching.mutate()}
              >
                {runMatching.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="size-3.5" />
                )}
                Run matching now
              </Button>
            </div>
          )}
          {isDeveloper && (
            <Button
              size="sm"
              className="min-h-9"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              List an item
            </Button>
          )}
        </div>
      </div>

      {isStaff && (
        <p className="-mt-4 text-xs text-muted-foreground/70">
          Matching runs on its own every five minutes — this button is only for
          not waiting during a demo.
        </p>
      )}

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="orders">My orders</TabsTrigger>
          <TabsTrigger value="trades">My trades</TabsTrigger>
          <TabsTrigger value="holdings">My holdings</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="pt-6">
          {isPending && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="space-y-3">
                  <Skeleton className="aspect-[16/10] w-full rounded-xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              The market did not load. Reload the page to try again.
            </p>
          )}

          {!isPending && !isError && items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-16 text-center">
              <Package
                className="mx-auto size-8 text-muted-foreground/40"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="mt-4 text-sm font-medium">No items listed yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Developers list items here once they have something to trade.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item, index) => (
                <ItemCard key={item.id} item={item} priority={index < 4} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="pt-6">
          <OrdersTab />
        </TabsContent>

        <TabsContent value="trades" className="pt-6">
          <TradesTab />
        </TabsContent>

        <TabsContent value="holdings" className="pt-6">
          <HoldingsTab />
        </TabsContent>
      </Tabs>

      {isDeveloper && (
        <NewItemDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </div>
  )
}

const ORDER_STATUS_TONE: Record<MarketOrderStatus, string> = {
  OPEN: "bg-warning/15 text-warning border-warning/25",
  FILLED: "bg-primary/15 text-primary border-primary/25",
  CANCELLED: "bg-muted text-muted-foreground border-border",
}

function OrdersTab() {
  const { data, isPending, isError } = useMyOrdersQuery()
  const cancel = useCancelMarketOrderMutation()
  const orders = data?.items ?? []

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Your orders did not load. Reload the page to try again.
      </p>
    )
  }

  if (orders.length === 0) {
    return (
      <EmptyTabState
        icon={ScrollText}
        title="No orders yet"
        message="A buy or sell order you place on an item's page appears here."
      />
    )
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {orders.map((order: MarketOrder) => (
        <li
          key={order.id}
          className="flex flex-wrap items-center gap-3 p-4 text-sm"
        >
          <span
            className={cn(
              "flex items-center gap-1 font-medium",
              order.side === "BUY" ? "text-primary" : "text-destructive"
            )}
          >
            {order.side === "BUY" ? (
              <ArrowDownToLine className="size-3.5" />
            ) : (
              <ArrowUpFromLine className="size-3.5" />
            )}
            {order.side === "BUY" ? "Buy" : "Sell"}
          </span>
          <span className="font-medium tabular">
            {formatMoney(order.price)}
          </span>
          <Badge className={cn("shrink-0", ORDER_STATUS_TONE[order.status])}>
            {order.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelative(order.created_at)}
          </span>
          {order.status === "OPEN" && (
            <Button
              variant="ghost"
              size="sm"
              className="ms-auto min-h-9"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(order.id)}
            >
              <X className="size-3.5" />
              Cancel
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function TradesTab() {
  const { data, isPending, isError } = useMyTradesQuery()
  const userId = useAuthStore((state) => state.userId)
  const trades = data?.items ?? []

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Your trades did not load. Reload the page to try again.
      </p>
    )
  }

  if (trades.length === 0) {
    return (
      <EmptyTabState
        icon={Receipt}
        title="No trades yet"
        message="Once one of your orders is matched, the trade shows up here."
      />
    )
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {trades.map((trade) => {
        const bought = trade.buyer_id === userId
        return (
          <li
            key={trade.id}
            className="flex flex-wrap items-center gap-3 p-4 text-sm"
          >
            <span
              className={cn(
                "font-medium",
                bought ? "text-primary" : "text-destructive"
              )}
            >
              {bought ? "Bought" : "Sold"}
            </span>
            <span className="font-medium tabular">
              {formatMoney(trade.price)}
            </span>
            <span className="ms-auto text-xs text-muted-foreground">
              {formatDateTime(trade.matched_at)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function HoldingsTab() {
  const { data: holdings, isPending, isError } = useHoldingsQuery()
  const { data: itemsPage } = useItemsQuery({ limit: 100 })

  const itemsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of itemsPage?.items ?? []) map.set(item.id, item.title)
    return map
  }, [itemsPage])

  const owned = (holdings ?? []).filter((holding) => holding.quantity > 0)

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Your holdings did not load. Reload the page to try again.
      </p>
    )
  }

  if (owned.length === 0) {
    return (
      <EmptyTabState
        icon={Boxes}
        title="Nothing in your holdings"
        message="Items staff hand out, or that a sell order of yours has filled, appear here."
      />
    )
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {owned.map((holding) => (
        <li
          key={holding.item_id}
          className="flex flex-wrap items-center gap-3 p-4 text-sm"
        >
          <span className="min-w-0 flex-1 truncate font-medium">
            {itemsById.get(holding.item_id) ?? "Item"}
          </span>
          <span className="text-muted-foreground tabular">
            × {holding.quantity}
          </span>
        </li>
      ))}
    </ul>
  )
}

function EmptyTabState({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof Package
  title: string
  message: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-16 text-center">
      <Icon
        className="mx-auto size-8 text-muted-foreground/40"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
