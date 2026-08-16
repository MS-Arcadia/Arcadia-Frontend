import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"
import { isAwaitingDeveloper } from "@/lib/promotion"

describe("isAwaitingDeveloper", () => {
  it("only PENDING means Support has proposed a discount the developer must answer", () => {
    expect(isAwaitingDeveloper("PENDING")).toBe(true)
    // The catalog has never emitted "PROPOSED"; matching it once left the
    // approve/decline panel permanently empty.
    expect(isAwaitingDeveloper("PROPOSED")).toBe(false)
    expect(isAwaitingDeveloper("ACTIVE")).toBe(false)
    expect(isAwaitingDeveloper("EXPIRED")).toBe(false)
    expect(isAwaitingDeveloper("")).toBe(false)
  })
})

describe("cn", () => {
  it("merges conditional classes and lets tailwind-merge resolve conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
    expect(cn("text-sm", false && "hidden", "font-medium")).toBe(
      "text-sm font-medium"
    )
  })
})
