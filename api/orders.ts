import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type { Page } from "@/types/common.api.type"
import type {
  InstalmentPlan,
  Order,
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
 * Placing an order answers **202**, not 201: the order exists but nothing has
 * been charged or granted yet, because a purchase is a saga across the wallet
 * and the catalog. A client that treats the response as "done" will show a
 * library entry that is not there yet — poll the order, or wait for the
 * notification.
 */
export async function placeOrder(body: PlaceOrderBody): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.place, body)
  return data
}

export async function placeGift(body: PlaceGiftBody): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.gift, body)
  return data
}

export async function placePreorder(body: PlaceOrderBody): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.preorder, body)
  return data
}

export async function placeInstalmentOrder(
  body: PlaceInstalmentBody
): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.instalment, body)
  return data
}

export async function refundOrder(id: string): Promise<Order> {
  const { data } = await http.post<Order>(API.orders.refund(id))
  return data
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
