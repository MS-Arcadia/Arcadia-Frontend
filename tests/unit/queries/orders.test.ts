import { act } from "@testing-library/react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { catalogKeys } from "@/api/catalog"
import { notificationKeys } from "@/api/notifications"
import { walletKeys } from "@/api/wallet"

vi.mock("@/api/orders", () => ({
  placeOrder: vi.fn(),
  placeGift: vi.fn(),
  placePreorder: vi.fn(),
  placeInstalmentOrder: vi.fn(),
  payNextInstalment: vi.fn(),
  refundOrder: vi.fn(),
  getOrders: vi.fn(),
  getOrder: vi.fn(),
  getInstalmentPlan: vi.fn(),
  orderKeys: {
    all: ["orders"] as const,
    list: () => ["orders", "list"] as const,
    detail: (id: string) => ["orders", id] as const,
    plan: (orderId: string) => ["orders", orderId, "instalment-plan"] as const,
  },
}))

import { placeOrder, refundOrder } from "@/api/orders"
import { useBuyGameMutation, useRefundMutation } from "@/queries/orders"

import { makeOrder } from "../../helpers/order"
import { renderHookWithQuery } from "../../helpers/query"

describe("useBuyGameMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("invalidates everything a sale touches — money, ownership and notifications", async () => {
    vi.mocked(placeOrder).mockResolvedValue(makeOrder({ state: "COMPLETED" }))
    const success = vi.spyOn(toast, "success")
    const { client, result } = renderHookWithQuery(() => useBuyGameMutation())
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await act(async () => {
      await result.current.mutateAsync({ game_id: "game-1" })
    })

    const invalidated = invalidate.mock.calls.map(([entry]) =>
      Array.isArray(entry.queryKey) ? entry.queryKey.join(".") : entry.queryKey
    )
    expect(invalidated).toEqual(
      expect.arrayContaining([
        walletKeys.all.join("."),
        "orders",
        [...catalogKeys.library()].join("."),
        [...notificationKeys.all].join("."),
      ])
    )
    expect(success).toHaveBeenCalledTimes(1)
    expect(success.mock.calls[0][0]).toBe("Neon Drift is yours")
  })

  it("a failed saga toasts the order's own failure message", async () => {
    vi.mocked(placeOrder).mockResolvedValue(
      makeOrder({
        state: "FAILED",
        failure_message: "Your wallet balance is not enough.",
      })
    )
    const error = vi.spyOn(toast, "error")
    const { result } = renderHookWithQuery(() => useBuyGameMutation())

    await act(async () => {
      await result.current.mutateAsync({ game_id: "game-1" })
    })

    expect(error).toHaveBeenCalledWith("Your wallet balance is not enough.")
  })
})

describe("useRefundMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("a completed refund says the money is back", async () => {
    vi.mocked(refundOrder).mockResolvedValue(makeOrder({ state: "REFUNDED" }))
    const success = vi.spyOn(toast, "success")
    const { result } = renderHookWithQuery(() => useRefundMutation())

    await act(async () => {
      await result.current.mutateAsync("order-1")
    })

    expect(success).toHaveBeenCalledWith("Neon Drift refunded", {
      description: "The money is back in your wallet.",
    })
  })

  it("a refund still in flight says so, rather than claiming the money is back", async () => {
    vi.mocked(refundOrder).mockResolvedValue(makeOrder({ state: "REFUNDING" }))
    const message = vi.spyOn(toast, "message")
    const { result } = renderHookWithQuery(() => useRefundMutation())

    await act(async () => {
      await result.current.mutateAsync("order-1")
    })

    expect(message).toHaveBeenCalledWith("Neon Drift refund is processing")
  })
})
