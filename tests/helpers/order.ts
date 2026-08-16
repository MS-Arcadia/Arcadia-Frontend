import type { Money } from "@/types/common.api.type"
import type { Order } from "@/types/order.api.type"

const ZERO: Money = { amount_minor: "0", currency: "IRR" }

/** A wire-shaped Order with the fields the flows under test actually read. */
export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    buyer_id: "11111111-1111-4111-8111-111111111111",
    game_id: "game-1",
    game_title: "Neon Drift",
    developer_id: "22222222-2222-4222-8222-222222222222",
    type: "PURCHASE",
    state: "COMPLETED",
    base_price: { amount_minor: "48000000", currency: "IRR" },
    total_charged: { amount_minor: "36000000", currency: "IRR" },
    developer_share: ZERO,
    platform_share: ZERO,
    discount: null,
    discount_code: "",
    gift: null,
    failure_reason: "",
    failure_message: "",
    created_at: "2026-08-16T10:00:00Z",
    completed_at: "2026-08-16T10:00:05Z",
    refunded_at: null,
    refundable_until: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    cancellable: false,
    saga: null,
    idempotent_replay: false,
    ...overrides,
  }
}
