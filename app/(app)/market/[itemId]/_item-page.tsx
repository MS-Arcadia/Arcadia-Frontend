"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Gift, Loader2, ShieldCheck } from "lucide-react"

import { OrderBook } from "@/components/marketplace/order-book"
import { PlaceOrderPanel } from "@/components/marketplace/place-order-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useDistributeItemMutation, useItemQuery } from "@/queries/marketplace"
import { useHasRole } from "@/stores/auth.store"
import { formatMoney } from "@/lib/money"

interface Props {
  itemId: string
}

export function ItemPage({ itemId }: Props) {
  const { data: item, isPending, isError } = useItemQuery(itemId)
  const isStaff = useHasRole("SUPPORT", "ADMIN")

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !item) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-lg font-semibold">No such item</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been withdrawn from the market.
        </p>
        <Button
          variant="outline"
          className="mt-5 min-h-11"
          nativeButton={false}
          render={<Link href="/market" />}
        >
          Back to the market
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ms-2 gap-1.5"
        nativeButton={false}
        render={<Link href="/market" />}
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        Market
      </Button>

      <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-border bg-card sm:h-72 lg:h-80">
        {item.image_url && (
          <Image
            src={item.image_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-card to-transparent"
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              {item.title}
            </h1>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Buy value{" "}
                <span className="font-medium text-foreground tabular">
                  {formatMoney(item.buy_value)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Sell value{" "}
                <span className="font-medium text-foreground tabular">
                  {formatMoney(item.sell_value)}
                </span>
              </span>
            </div>
          </div>

          <p className="max-w-2xl leading-relaxed text-muted-foreground">
            {item.description}
          </p>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Order book</h2>
            <OrderBook itemId={item.id} />
          </section>

          {isStaff && <DistributeSection itemId={item.id} title={item.title} />}
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <PlaceOrderPanel itemId={item.id} />
        </div>
      </div>
    </div>
  )
}

function DistributeSection({
  itemId,
  title,
}: {
  itemId: string
  title: string
}) {
  const distribute = useDistributeItemMutation()
  const [count, setCount] = useState("10")
  const parsed = Number.parseInt(count, 10)
  // Marketplace refuses anything outside 1..500 (`maxDistribution`).
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 500

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4" strokeWidth={1.75} />
        Hand out to random users
      </h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Staff-only. Grants {title} to that many random users, free of charge —
        this is how an item enters circulation before anyone can trade it.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="distribute-count" className="text-xs">
            Recipients
          </Label>
          <Input
            id="distribute-count"
            inputMode="numeric"
            value={count}
            onChange={(event) =>
              setCount(event.target.value.replace(/[^\d]/g, ""))
            }
            className="min-h-9 w-24 tabular"
          />
        </div>
        <Button
          size="sm"
          className="min-h-9"
          disabled={distribute.isPending || !valid}
          onClick={() => distribute.mutate({ itemId, count: parsed })}
        >
          {distribute.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Gift className="size-3.5" />
          )}
          Distribute
        </Button>
      </div>
    </section>
  )
}
