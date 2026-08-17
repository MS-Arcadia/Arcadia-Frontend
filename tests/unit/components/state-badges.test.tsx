import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { GameStateBadge, stateLabel } from "@/components/game/game-state-badge"
import { FestivalStateBadge } from "@/components/festival/festival-state-badge"
import type { GameState } from "@/types/catalog.api.type"

describe("GameStateBadge", () => {
  it("labels the nine states without flattening them", () => {
    const expected: Record<GameState, string> = {
      DRAFT: "Draft",
      SUBMITTED: "Waiting for review",
      IN_REVIEW: "In review",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      APPEALED: "Appealed",
      PRICED: "Waiting to publish",
      PREORDER: "Pre-order",
      PUBLISHED: "On sale",
    }
    for (const [state, label] of Object.entries(expected)) {
      const { unmount } = render(<GameStateBadge state={state as GameState} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(stateLabel(state as GameState)).toBe(label)
      unmount()
    }
  })

  it("withdrawn wins over the state — a pulled PUBLISHED game is not on sale", () => {
    render(<GameStateBadge state="PUBLISHED" withdrawn={true} />)
    expect(screen.getByText("Withdrawn")).toBeInTheDocument()
    expect(screen.queryByText("On sale")).not.toBeInTheDocument()
  })
})

describe("FestivalStateBadge", () => {
  it("labels each festival state in a shopper's words", () => {
    const cases: Array<[string, string]> = [
      ["DRAFT", "Draft"],
      ["ACTIVE", "Live now"],
      ["ENDED", "Ended"],
      ["CANCELLED", "Cancelled"],
    ]
    for (const [state, label] of cases) {
      const { unmount } = render(<FestivalStateBadge state={state as never} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })
})
