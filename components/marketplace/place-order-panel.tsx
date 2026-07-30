"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useHoldingsQuery,
  usePlaceMarketOrderMutation,
} from "@/queries/marketplace"
import { toMinorUnits } from "@/schemas/marketplace.schema"
import type { OrderSide } from "@/types/marketplace.api.type"

interface Props {
  itemId: string
}

/**
 * A BUY/SELL toggle and a price, mirroring `AcquirePanel`'s tab layout: each
 * side is a different commitment, so it gets its own copy rather than one form
 * that quietly changes meaning under a dropdown.
 */
export function PlaceOrderPanel({ itemId }: Props) {
  const { data: holdings } = useHoldingsQuery()
  const place = usePlaceMarketOrderMutation()

  const [price, setPrice] = useState("")

  const quantity =
    holdings?.find((holding) => holding.item_id === itemId)?.quantity ?? 0
  const canSell = quantity > 0

  function submit(side: OrderSide) {
    place.mutate(
      { item_id: itemId, side, price: toMinorUnits(price) },
      { onSuccess: () => setPrice("") }
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Tabs defaultValue="buy">
        <TabsList className="w-full">
          <TabsTrigger value="buy" className="flex-1">
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className="flex-1" disabled={!canSell}>
            Sell
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-4 pt-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            A buy order sits in the book until a matching sell order fills it —
            the matching pass runs every five minutes.
          </p>
          <PriceField id="buy-price" price={price} onChange={setPrice} />
          <Button
            className="min-h-11 w-full"
            disabled={place.isPending || !price}
            onClick={() => submit("BUY")}
          >
            {place.isPending && <Loader2 className="size-4 animate-spin" />}
            Place buy order
          </Button>
        </TabsContent>

        <TabsContent value="sell" className="space-y-4 pt-5">
          {canSell ? (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                You hold {quantity}. A sell order sits in the book until a
                matching buy order fills it.
              </p>
              <PriceField id="sell-price" price={price} onChange={setPrice} />
              <Button
                className="min-h-11 w-full"
                variant="outline"
                disabled={place.isPending || !price}
                onClick={() => submit("SELL")}
              >
                {place.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Place sell order
              </Button>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              You do not hold this item, so there is nothing to sell. It has to
              be handed to you first — by staff, or by a buy order of yours
              being filled.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PriceField({
  id,
  price,
  onChange,
}: {
  id: string
  price: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">
        Price
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="500000"
        className="min-h-11 tabular"
        value={price}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
      />
    </div>
  )
}
