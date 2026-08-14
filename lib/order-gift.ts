import type { Order } from "@/types/order.api.type"

/** True when this viewer is the person the gift was for, not the person who paid. */
export function isReceivedGift(
  order: Order,
  userId: string | undefined
): boolean {
  return Boolean(
    userId &&
    order.gift &&
    order.gift.recipient_id === userId &&
    order.buyer_id !== userId
  )
}
