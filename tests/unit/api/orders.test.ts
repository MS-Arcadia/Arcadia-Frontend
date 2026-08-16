import { describe, expect, it, vi } from "vitest"

import { API } from "@/lib/api-paths"

vi.mock("@/services/mocks/adapter", () => ({
  installMockAdapter: vi.fn(),
}))

import {
  getOrder,
  getOrders,
  placeGift,
  placeInstalmentOrder,
  placeOrder,
  placePreorder,
  refundOrder,
} from "@/api/orders"

import { scriptedHttp, waitForCalls } from "../../helpers/http"
import { makeOrder } from "../../helpers/order"

const BODY = { game_id: "game-1" }

describe("reading orders", () => {
  it("lists with a limit of fifty, and fetches one by id", async () => {
    const calls = scriptedHttp()

    const list = getOrders()
    await waitForCalls(calls, 1)
    calls[0].respond({ data: { items: [], total: 0, limit: 50, offset: 0 } })
    await expect(list).resolves.toMatchObject({ items: [] })
    expect(calls[0].request.params).toEqual({ limit: 50 })

    const one = getOrder("order-9")
    await waitForCalls(calls, 2)
    calls[1].respond({ data: makeOrder() })
    await expect(one).resolves.toMatchObject({ id: "order-1" })
    expect(calls[1].request.url.endsWith(API.orders.detail("order-9"))).toBe(
      true
    )
  })
})

describe("placing orders waits for the saga", () => {
  it("a 202 that lands COMPLETED on the first poll resolves with the settled order", async () => {
    const calls = scriptedHttp()

    const pending = placeOrder(BODY)
    await waitForCalls(calls, 1)
    calls[0].respond({ status: 202, data: makeOrder({ state: "PENDING" }) })

    await waitForCalls(calls, 2)
    calls[1].respond({
      data: makeOrder({ state: "COMPLETED", idempotent_replay: false }),
    })

    await expect(pending).resolves.toMatchObject({ state: "COMPLETED" })
    expect(calls).toHaveLength(2)
  })

  it("keeps polling with a growing backoff until the state is decided", async () => {
    const calls = scriptedHttp()

    const pending = placeOrder(BODY)
    await waitForCalls(calls, 1)
    calls[0].respond({ status: 202, data: makeOrder({ state: "PENDING" }) })

    await waitForCalls(calls, 2)
    calls[1].respond({ data: makeOrder({ state: "PENDING" }) })

    await waitForCalls(calls, 3)
    calls[2].respond({ data: makeOrder({ state: "FAILED" }) })

    // A saga that failed resolves (not rejects) — the caller shows the order's
    // own failure message rather than a transport error.
    await expect(pending).resolves.toMatchObject({ state: "FAILED" })
  })

  it("a gift's 202 and a pre-order's 202 settle the same way", async () => {
    const calls = scriptedHttp()

    const gift = placeGift({
      ...BODY,
      recipient_id: "friend",
      message: "enjoy",
    })
    await waitForCalls(calls, 1)
    expect(calls[0].request.url.endsWith(API.orders.gift)).toBe(true)
    calls[0].respond({ status: 202, data: makeOrder({ state: "PENDING" }) })

    const preorder = placePreorder(BODY)
    await waitForCalls(calls, 2)
    expect(calls[1].request.url.endsWith(API.orders.preorder)).toBe(true)
    calls[1].respond({ status: 202, data: makeOrder({ state: "PENDING" }) })

    const instalment = placeInstalmentOrder({
      ...BODY,
      instalments: 3,
      interval_days: 30,
    })
    await waitForCalls(calls, 3)
    expect(calls[2].request.url.endsWith(API.orders.instalment)).toBe(true)
    calls[2].respond({ status: 202, data: makeOrder({ state: "PENDING" }) })

    await waitForCalls(calls, 6)
    for (const index of [3, 4, 5]) {
      calls[index].respond({ data: makeOrder({ state: "COMPLETED" }) })
    }

    await Promise.all([
      expect(gift).resolves.toMatchObject({ state: "COMPLETED" }),
      expect(preorder).resolves.toMatchObject({ state: "COMPLETED" }),
      expect(instalment).resolves.toMatchObject({ state: "COMPLETED" }),
    ])
  })
})

describe("refunds wait for the wallet too", () => {
  it("REFUNDING is polled until it is REFUNDED", async () => {
    const calls = scriptedHttp()

    const pending = refundOrder("order-1")
    await waitForCalls(calls, 1)
    calls[0].respond({ data: makeOrder({ state: "REFUNDING" }) })

    await waitForCalls(calls, 2)
    calls[1].respond({ data: makeOrder({ state: "REFUNDING" }) })

    await waitForCalls(calls, 3)
    calls[2].respond({ data: makeOrder({ state: "REFUNDED" }) })

    await expect(pending).resolves.toMatchObject({ state: "REFUNDED" })
  })

  it("an immediate REFUNDED answer resolves without polling", async () => {
    const calls = scriptedHttp()

    const pending = refundOrder("order-1")
    await waitForCalls(calls, 1)
    calls[0].respond({ data: makeOrder({ state: "REFUNDED" }) })

    await expect(pending).resolves.toMatchObject({ state: "REFUNDED" })
    expect(calls).toHaveLength(1)
  })
})
