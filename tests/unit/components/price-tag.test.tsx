import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PriceTag } from "@/components/game/price-tag"
import { majorIrr, makeGame } from "../../helpers/game"

describe("PriceTag", () => {
  it("renders the formatted price with its currency", () => {
    render(<PriceTag game={makeGame()} />)
    expect(screen.getByText("480,000 IRR")).toBeInTheDocument()
  })

  it("a zero effective price reads as Free, not as a zero loading state", () => {
    render(<PriceTag game={makeGame({ effective_price: majorIrr(0) })} />)
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.queryByText(/IRR/)).not.toBeInTheDocument()
  })

  it("a discount shows the percentage, the price paid and the struck-through original", () => {
    render(
      <PriceTag
        game={makeGame({
          discount_bps: 2500,
          effective_price: majorIrr(360_000),
        })}
      />
    )

    expect(screen.getByText("25% off")).toBeInTheDocument()
    expect(screen.getByText("360,000 IRR")).toBeInTheDocument()
    // The original price is struck through, not merely greyed.
    const original = screen.getByText("480,000 IRR")
    expect(original.className).toContain("line-through")
  })

  it("discount bps with no base price to strike through shows no badge either", () => {
    render(
      <PriceTag
        game={makeGame({
          discount_bps: 2500,
          final_price: null,
          effective_price: majorIrr(360_000),
        })}
      />
    )
    // There is nothing to strike through, so advertising a percentage would
    // promise a comparison the card cannot show.
    expect(screen.queryByText("25% off")).not.toBeInTheDocument()
    expect(screen.getByText("360,000 IRR")).toBeInTheDocument()
  })

  it("falls back to final_price when effective_price is absent", () => {
    render(
      <PriceTag game={makeGame({ effective_price: null, final_price: majorIrr(410_000) })} />
    )
    expect(screen.getByText("410,000 IRR")).toBeInTheDocument()
  })
})
