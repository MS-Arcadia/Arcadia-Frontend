"use client"

import { useState } from "react"
import { Loader2, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRefundMutation } from "@/queries/orders"
import { timeUntil } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { Order } from "@/types/order.api.type"

interface Props {
  order: Order
  size?: "sm" | "default"
  className?: string
}

/**
 * The refund CTA plus the confirmation it needs. Taking a game out of someone's
 * library is not a one-click action — the dialog says where the money goes and
 * that the title leaves with it.
 */
export function RefundButton({ order, size = "sm", className }: Props) {
  const [open, setOpen] = useState(false)
  const refund = useRefundMutation()
  const left = timeUntil(order.refundable_until)
  const paying = order.state === "PAYING"

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="size-3.5" />
        Refund
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund {order.game_title}?</DialogTitle>
            <DialogDescription>
              {paying
                ? "What you have already paid goes back to your wallet. Remaining payments are cancelled, and the game leaves your library."
                : `${formatMoney(order.total_charged)} goes back to your wallet, and the game leaves your library.`}
              {left ? ` You have ${left} left to do this.` : ""}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Keep the game
            </DialogClose>
            <Button
              variant="destructive"
              disabled={refund.isPending}
              onClick={() =>
                refund.mutate(order.id, {
                  onSuccess: () => setOpen(false),
                })
              }
            >
              {refund.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Refund to wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
