import { beforeEach, describe, expect, it } from "vitest"

import { PLAYER_ID, DEVELOPER_ID, SUPPORT_ID } from "@/services/mocks/seed"
import {
  MockRuleError,
  addVersion,
  approveGame,
  buy,
  currentUser,
  db,
  gameById,
  gift,
  ownedGameIds,
  publishGame,
  refund,
  registerGame,
  resetDb,
  requireRole,
  setFinalPrice,
  setBanned,
  signIn,
  signOut,
  submitGame,
  suggestPrice,
  startReview,
  walletOf,
} from "@/services/mocks/db"

function gameId(title: string): string {
  return db.games.find((game) => game.title === title)!.id
}

/** The wallet as a plain bigint of minor units. */
function balance(): bigint {
  return BigInt(walletOf(PLAYER_ID).balance.amount_minor)
}

/** The rule the mock is asserting, as `status:reason` — the RFC 7807 the real
 *  services answer with. */
function ruleOf(action: () => unknown): string {
  try {
    action()
    throw new Error("expected the mock to refuse this")
  } catch (error) {
    if (error instanceof MockRuleError) return `${error.status}:${error.reason}`
    throw error
  }
}

beforeEach(() => {
  resetDb()
})

describe("sign-in rules", () => {
  it("a correct password signs in", () => {
    const user = signIn("player@arcadia.local", "player-password")
    expect(user.user_id).toBe(PLAYER_ID)
    expect(currentUser().user_id).toBe(PLAYER_ID)
  })

  it("a wrong password is 401 INVALID_CREDENTIALS", () => {
    expect(ruleOf(() => signIn("player@arcadia.local", "nope"))).toBe(
      "401:INVALID_CREDENTIALS"
    )
  })

  it("an email is matched case-insensitively and trimmed", () => {
    expect(
      signIn("  Player@Arcadia.Local ", "player-password").user_id
    ).toBe(PLAYER_ID)
  })

  it("a pending registration cannot sign in yet", () => {
    expect(ruleOf(() => signIn("hopeful@arcadia.local", "hopeful-password"))).toBe(
      "403:ACCOUNT_PENDING"
    )
  })

  it("a banned account is refused", () => {
    signIn("admin@arcadia.com", "admin-password")
    setBanned(PLAYER_ID, true, "test ban")
    signOut()
    expect(ruleOf(() => signIn("player@arcadia.local", "player-password"))).toBe(
      "403:ACCOUNT_BANNED"
    )
  })

  it("with no session, currentUser is 401 TOKEN_MISSING", () => {
    expect(ruleOf(currentUser)).toBe("401:TOKEN_MISSING")
  })

  it("requireRole refuses a role the viewer does not hold", () => {
    signIn("player@arcadia.local", "player-password")
    expect(ruleOf(() => requireRole("DEVELOPER"))).toBe("403:ROLE_REQUIRED")
  })
})

describe("buying", () => {
  beforeEach(() => {
    signIn("player@arcadia.local", "player-password")
  })

  it("a purchase debits the wallet, grants the game and lands as COMPLETED", () => {
    const before = balance()
    const paperKingdoms = gameId("Paper Kingdoms")

    const order = buy(paperKingdoms)

    expect(order.state).toBe("COMPLETED")
    expect(order.game_id).toBe(paperKingdoms)
    expect(balance()).toBe(before - 350_000_00n)
    expect(ownedGameIds(PLAYER_ID).has(paperKingdoms)).toBe(true)
  })

  it("buying twice is refused, because the library already holds it", () => {
    buy(gameId("Paper Kingdoms"))
    expect(ruleOf(() => buy(gameId("Paper Kingdoms")))).toBe(
      "409:ALREADY_OWNED"
    )
  })

  it("a game that is not PUBLISHED is not for sale", () => {
    expect(ruleOf(() => buy(gameId("Glasshouse")))).toBe("409:NOT_FOR_SALE")
  })

  it("a free game is granted without touching the wallet", () => {
    const before = balance()
    buy(gameId("Lantern Way"))
    expect(balance()).toBe(before)
    expect(ownedGameIds(PLAYER_ID).has(gameId("Lantern Way"))).toBe(true)
  })

  it("a short balance is refused rather than going negative", () => {
    walletOf(PLAYER_ID).balance = { amount_minor: "100", currency: "IRR" }
    expect(ruleOf(() => buy(gameId("Paper Kingdoms")))).toBe(
      "409:INSUFFICIENT_FUNDS"
    )
  })
})

describe("gifting and refunds", () => {
  beforeEach(() => {
    signIn("player@arcadia.local", "player-password")
  })

  it("a gift charges the buyer, adds a 2% message fee, and grants the recipient", () => {
    const before = balance()
    const order = gift(gameId("Paper Kingdoms"), SUPPORT_ID, "enjoy!")

    // 350,000 IRR + 2% message fee = 357,000.
    expect(balance()).toBe(before - 357_000_00n)
    expect(order.gift?.recipient_id).toBe(SUPPORT_ID)
    expect(ownedGameIds(SUPPORT_ID).has(gameId("Paper Kingdoms"))).toBe(true)
    expect(ownedGameIds(PLAYER_ID).has(gameId("Paper Kingdoms"))).toBe(false)
  })

  it("a gift without a message carries no fee", () => {
    const before = balance()
    gift(gameId("Vault of Echoes"), SUPPORT_ID, "  ")
    expect(balance()).toBe(before - 620_000_00n)
  })

  it("a gift cannot be refunded — the game is in somebody else's library", () => {
    const order = gift(gameId("Iron Bloom"), SUPPORT_ID, "enjoy")
    expect(ruleOf(() => refund(order.id))).toBe("409:GIFT_NOT_REFUNDABLE")
  })

  it("a refund inside the window credits the wallet back and revokes the game", () => {
    const before = balance()
    const order = buy(gameId("Vault of Echoes"))

    const refunded = refund(order.id)

    expect(refunded.state).toBe("REFUNDED")
    expect(balance()).toBe(before)
    expect(ownedGameIds(PLAYER_ID).has(order.game_id)).toBe(false)
  })

  it("the twelve-hour window is enforced against the server's own deadline", () => {
    const order = buy(gameId("Vault of Echoes"))
    const stored = db.orders.find((candidate) => candidate.id === order.id)!
    stored.refundable_until = new Date(Date.now() - 1000).toISOString()

    expect(ruleOf(() => refund(order.id))).toBe("409:REFUND_WINDOW_CLOSED")
  })

  it("somebody else's order is a 404, not a refusal reason", () => {
    signIn("support@arcadia.local", "support-password")
    walletOf(SUPPORT_ID).balance = { amount_minor: "100000000", currency: "IRR" }
    const foreign = buy(gameId("Paper Kingdoms"))
    signIn("player@arcadia.local", "player-password")
    expect(ruleOf(() => refund(foreign.id))).toBe("404:NOT_FOUND")
  })

  it("an already-refunded order cannot be refunded again", () => {
    const order = buy(gameId("Vault of Echoes"))
    refund(order.id)
    expect(ruleOf(() => refund(order.id))).toBe("409:ORDER_NOT_COMPLETED")
  })
})

describe("the publishing workflow", () => {
  beforeEach(() => {
    signIn("dev@arcadia.local", "dev-password")
  })

  function draftGame(): string {
    return registerGame({
      title: "Test Bench",
      description: "A game made to be walked through the states.",
      min_requirements: "None worth listing.",
      genres: ["Testing"],
    }).id
  }

  it("a new game starts in DRAFT, owned by its developer", () => {
    const game = gameById(draftGame())
    expect(game.state).toBe("DRAFT")
    expect(game.developer_id).toBe(DEVELOPER_ID)
  })

  it("submit is refused without a build — there is nothing to review", () => {
    const id = draftGame()
    expect(ruleOf(() => submitGame(id))).toBe("409:NO_VERSION")
  })

  it("walks the happy path: build → submit → review → approve → price → publish", () => {
    const id = draftGame()
    addVersion(id, "1.0.0", 1024)

    expect(submitGame(id).state).toBe("SUBMITTED")

    signIn("support@arcadia.local", "support-password")
    expect(startReview(id).state).toBe("IN_REVIEW")
    expect(approveGame(id, "looks good").state).toBe("APPROVED")
    suggestPrice(id, 550_000_00)
    expect(gameById(id).suggested_price?.amount_minor).toBe("55000000")

    signIn("dev@arcadia.local", "dev-password")
    expect(setFinalPrice(id, 550_000_00).state).toBe("PRICED")
    expect(publishGame(id).state).toBe("PUBLISHED")
    expect(gameById(id).published_at).not.toBeNull()
  })

  it("publish before pricing is refused", () => {
    const id = draftGame()
    addVersion(id, "1.0.0", 1024)
    submitGame(id)

    signIn("support@arcadia.local", "support-password")
    startReview(id)
    approveGame(id, "")

    signIn("dev@arcadia.local", "dev-password")
    expect(ruleOf(() => publishGame(id))).toBe("409:NOT_PRICED")
  })

  it("a negative price is refused outright", () => {
    const id = draftGame()
    expect(ruleOf(() => setFinalPrice(id, -1))).toBe("400:VALIDATION_FAILED")
  })

  it("the published terminal state refuses any further transition", () => {
    const id = gameId("Neon Drift") // seeded PUBLISHED, someone else's
    // Buying it is fine; the developer's own PUBLISHED game cannot resubmit.
    const own = draftGame()
    addVersion(own, "1.0.0", 1024)
    submitGame(own)
    signIn("support@arcadia.local", "support-password")
    startReview(own)
    approveGame(own, "")
    signIn("dev@arcadia.local", "dev-password")
    setFinalPrice(own, 100_00)
    publishGame(own)
    expect(ruleOf(() => submitGame(own))).toBe("409:ILLEGAL_TRANSITION")
    expect(gameById(id).state).toBe("PUBLISHED")
  })
})
