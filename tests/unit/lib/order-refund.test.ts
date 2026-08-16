import { describe, expect, it } from "vitest"

import { isReceivedGift } from "@/lib/order-gift"
import { isRefundable, refundableOrderForGame } from "@/lib/order-refund"
import type { Money } from "@/types/common.api.type"
import type { Order } from "@/types/order.api.type"

import { makeOrder } from "../../helpers/order"

const ZERO: Money = { amount_minor: "0", currency: "IRR" }

/** An Order with the fields the refund/gift rules read; the rest are filler. */
function order(overrides: Partial<Order>): Order {
  return makeOrder(overrides)
}

describe("isRefundable — the order service's begin_refund rules", () => {
  it("a completed order inside the window is refundable", () => {
    expect(isRefundable(order({}))).toBe(true)
  })

  it("an instalment order mid-payment counts too", () => {
    expect(isRefundable(order({ state: "PAYING" }))).toBe(true)
  })

  it("the server's deadline decides the window, and a closed one is final", () => {
    expect(
      isRefundable(
        order({ refundable_until: new Date(Date.now() - 1).toISOString() })
      )
    ).toBe(false)
    expect(isRefundable(order({ refundable_until: null }))).toBe(false)
  })

  it("a gift cannot be refunded — the game is in somebody else's library", () => {
    expect(
      isRefundable(
        order({
          gift: {
            recipient_id: "friend",
            message: "enjoy",
            message_fee: ZERO,
          },
        })
      )
    ).toBe(false)
  })

  it("states where money is undecided do not qualify", () => {
    expect(isRefundable(order({ state: "PENDING" }))).toBe(false)
    expect(isRefundable(order({ state: "CANCELLED" }))).toBe(false)
    expect(isRefundable(order({ state: "REFUNDED" }))).toBe(false)
  })
})

describe("refundableOrderForGame", () => {
  it("finds the one refundable order for a game among several", () => {
    const refundable = order({ id: "yes", game_id: "game-1" })
    const notYet = order({ id: "pending", game_id: "game-1", state: "PENDING" })
    const other = order({ id: "other", game_id: "game-2" })
    const past = order({
      id: "late",
      game_id: "game-1",
      refundable_until: "2020-01-01T00:00:00Z",
    })

    expect(refundableOrderForGame([notYet, other, refundable, past], "game-1")).toBe(
      refundable
    )
  })

  it("returns undefined for nothing, an empty list or no match", () => {
    expect(refundableOrderForGame(undefined, "game-1")).toBeUndefined()
    expect(refundableOrderForGame([], "game-1")).toBeUndefined()
    expect(refundableOrderForGame([order({ game_id: "game-2" })], "game-1")).toBeUndefined()
  })
})

describe("isReceivedGift", () => {
  const gift = {
    recipient_id: "friend",
    message: "enjoy",
    message_fee: ZERO,
  }

  it("true for the person the gift was for, not the person who paid", () => {
    expect(isReceivedGift(order({ buyer_id: "buyer", gift }), "friend")).toBe(
      true
    )
    expect(isReceivedGift(order({ buyer_id: "buyer", gift }), "buyer")).toBe(
      false
    )
  })

  it("false without a gift, a user, or a stranger's gift", () => {
    expect(isReceivedGift(order({ buyer_id: "buyer" }), "buyer")).toBe(false)
    expect(isReceivedGift(order({ buyer_id: "buyer", gift }), undefined)).toBe(
      false
    )
    expect(isReceivedGift(order({ buyer_id: "buyer", gift }), "stranger")).toBe(
      false
    )
  })
})
