import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { GameCard } from "@/components/game/game-card"

import { makeGame } from "../../helpers/game"

describe("GameCard", () => {
  it("links to the game under the given base path and shows its price", () => {
    render(<GameCard game={makeGame()} />)

    const link = screen.getByRole("link", { name: /Neon Drift/ })
    expect(link).toHaveAttribute("href", "/games/game-1")
    expect(screen.getByText("480,000 IRR")).toBeInTheDocument()
  })

  it("the public catalogue base path links to /browse instead", () => {
    render(<GameCard game={makeGame()} basePath="/browse" />)
    expect(screen.getByRole("link", { name: /Neon Drift/ })).toHaveAttribute(
      "href",
      "/browse/game-1"
    )
  })

  it("an owned game is badged, as is a pre-order", () => {
    const { rerender } = render(<GameCard game={makeGame()} owned={true} />)
    expect(screen.getByText("In library")).toBeInTheDocument()

    rerender(
      <GameCard
        game={makeGame({ state: "PREORDER", release_at: "2026-09-01" })}
      />
    )
    expect(screen.getByText("Pre-order")).toBeInTheDocument()
  })

  it("with no art at all, the title's first letter stands in", () => {
    render(<GameCard game={makeGame({ media: [], teaser_ref: "" })} />)
    expect(screen.getByText("N")).toBeInTheDocument()
  })

  it("genres are capped at two chips", () => {
    render(
      <GameCard
        game={makeGame({ genres: ["Racing", "Indie", "Action", "Roguelike"] })}
      />
    )
    expect(screen.getByText("Racing")).toBeInTheDocument()
    expect(screen.getByText("Indie")).toBeInTheDocument()
    expect(screen.queryByText("Action")).not.toBeInTheDocument()
    expect(screen.queryByText("Roguelike")).not.toBeInTheDocument()
  })
})
