import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Order } from "@/types/order.api.type"

const mutate = vi.fn()

vi.mock("@/queries/orders", () => ({
  useRefundMutation: () => ({
    mutate: (id: string, options: unknown) => {
      mutate(id, options)
      ;(options as { onSuccess?: () => void }).onSuccess?.()
    },
    isPending: false,
  }),
}))

import { RefundButton } from "@/components/order/refund-button"

import { makeOrder } from "../../helpers/order"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("RefundButton", () => {
  it("says where the money goes, and how long the window stays open", async () => {
    const user = userEvent.setup()
    render(
      <RefundButton
        order={makeOrder({
          game_title: "Hollow Signal",
          total_charged: { amount_minor: "72000000", currency: "IRR" },
          refundable_until: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        })}
      />
    )

    await user.click(screen.getByRole("button", { name: "Refund" }))

    expect(
      await screen.findByText(/720,000 IRR goes back to your wallet/)
    ).toBeInTheDocument()
    expect(await screen.findByText(/You have \d+h \d+m left/)).toBeInTheDocument()
  })

  it("an instalment order is told what happens to its remaining payments", async () => {
    const user = userEvent.setup()
    render(
      <RefundButton order={makeOrder({ state: "PAYING", game_title: "Iron Bloom" })} />
    )

    await user.click(screen.getByRole("button", { name: "Refund" }))

    expect(
      await screen.findByText(/Remaining payments are cancelled/)
    ).toBeInTheDocument()
  })

  it("a closed window drops the countdown line rather than counting negative", async () => {
    const user = userEvent.setup()
    render(
      <RefundButton
        order={makeOrder({ refundable_until: new Date(Date.now() - 1000).toISOString() })}
      />
    )

    await user.click(screen.getByRole("button", { name: "Refund" }))

    // Wait for the dialog to mount, then assert the countdown is absent.
    await screen.findByText(/goes back to your wallet/)
    expect(screen.queryByText(/You have/)).not.toBeInTheDocument()
  })

  it("confirming asks the refund mutation for this order", async () => {
    const user = userEvent.setup()
    render(<RefundButton order={makeOrder({ id: "order-7" })} />)

    await user.click(screen.getByRole("button", { name: "Refund" }))
    await user.click(screen.getByRole("button", { name: "Refund to wallet" }))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0][0]).toBe("order-7")
  })
})
