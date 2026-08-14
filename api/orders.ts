import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Page } from "@/types/common.api.type"
import type {
  InstalmentPlan,
  Order,
  OrderState,
  PlaceGiftBody,
  PlaceInstalmentBody,
  PlaceOrderBody,
} from "@/types/order.api.type"

export const orderKeys = {
  all: ["orders"] as const,
  list: () => ["orders", "list"] as const,
  detail: (id: string) => ["orders", id] as const,
  plan: (orderId: string) => ["orders", orderId, "instalment-plan"] as const,
}

export async function getOrders(): Promise<Page<Order>> {
  const { data } = await http.get<Page<Order>>(API.orders.list, {
    params: { limit: 50 },
  })
  return data
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await http.get<Order>(API.orders.detail(id))
  return data
}

/**
 * States in which money and ownership have already been decided. PENDING is the
 * 202 from placing: the saga is still talking to the wallet.
 */
const SETTLED = new Set<OrderState>([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "RESERVED",
  "PAYING",
  "DEFAULTED",
  "REFUNDED",
  "REFUNDING",
])

async function settleOrder(order: Order, ms = 20_000): Promise<Order> {
  if (SETTLED.has(order.state)) return order
  const deadline = Date.now() + ms
  let delay = 200
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    const next = await getOrder(order.id)
    if (SETTLED.has(next.state)) return next
    delay = Math.min(Math.round(delay * 1.4), 1000)
  }
  return getOrder(order.id)
}

/**
 * Placing an order answers **202**, not 201: the order exists but nothing has
 * been charged or granted yet, because a purchase is a saga across the wallet
 * and the catalog. These wait until that saga finishes (or times out still
 * PENDING) so a success toast is not a lie.
 */
export async function placeOrder(body: PlaceOrderBody): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.place, body)
  return settleOrder(data)
}

export async function placeGift(body: PlaceGiftBody): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.gift, body)
  return settleOrder(data)
}

export async function placePreorder(body: PlaceOrderBody): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.preorder, body)
  return settleOrder(data)
}

export async function placeInstalmentOrder(
  body: PlaceInstalmentBody
): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.instalment, body)
  return settleOrder(data)
}

/**
 * The refund endpoint answers `REFUNDING`, not `REFUNDED` — the commands are
 * out, the wallet has not confirmed yet. Waiting here is what keeps the toast
 * from claiming the money is back while it is still in flight.
 */
async function settleRefund(order: Order, ms = 20_000): Promise<Order> {
  if (order.state !== "REFUNDING") return order
  const deadline = Date.now() + ms
  let delay = 200
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    const next = await getOrder(order.id)
    if (next.state !== "REFUNDING") return next
    delay = Math.min(Math.round(delay * 1.4), 1000)
  }
  return getOrder(order.id)
}

export async function refundOrder(id: string): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.refund(id))
  return settleRefund(data)
}

export async function getInstalmentPlan(
  orderId: string
): Promise<InstalmentPlan> {
  const { data } = await http.get<InstalmentPlan>(API.orders.plan(orderId))
  return data
}

/**
 * Pay the next instalment now.
 *
 * **Not an endpoint the order service has.** It collects on a schedule, so there is
 * nothing to call — the mock provides this so the plan flow can be exercised
 * without waiting a month, and the order page says as much next to the button.
 * When a real "pay early" endpoint exists, only this function changes.
 */
export async function payNextInstalment(
  orderId: string
): Promise<InstalmentPlan> {
  const { data } = await http.post<InstalmentPlan>(
    `${API.orders.plan(orderId)}/pay-next`
  )
  return data
}
