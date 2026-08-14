import { timeUntil } from "@/lib/datetime"
import type { Order } from "@/types/order.api.type"

/**
 * Same rules the order service enforces on `begin_refund`: twelve hours from
 * purchase, not a gift, and either paid in full or still on instalments.
 *
 * `refundable_until` is the server's deadline so we never recompute the window
 * and disagree with it. PAYING counts because an instalment buyer who changes
 * their mind an hour after the game landed has the same claim as anyone else.
 */
export function isRefundable(order: Order): boolean {
  if (order.gift) return false
  if (order.state !== "COMPLETED" && order.state !== "PAYING") return false
  return timeUntil(order.refundable_until) !== null
}

export function refundableOrderForGame(
  orders: readonly Order[] | undefined,
  gameId: string
): Order | undefined {
  return orders?.find(
    (order) => order.game_id === gameId && isRefundable(order)
  )
}
