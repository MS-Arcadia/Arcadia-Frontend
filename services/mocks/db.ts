/**
 * The stand-in backend.
 *
 * This is deliberately more than a folder of static JSON. It keeps state for the
 * length of a page session and enforces the rules the real services enforce, so
 * that the UI is built against behaviour rather than against a happy path:
 *
 *  - buying debits the wallet, and fails when the balance is short
 *  - buying twice is refused, because the library already holds it
 *  - a purchase writes a ledger entry and a notification, like the real fan-out
 *  - a refund is refused once the twelve-hour window has closed
 *  - `effective_price` is derived from a live promotion, never stored twice
 *
 * Every field name and enum value matches the service it stands for — those came
 * from the services' own DTOs. Getting a name wrong here would be worse than
 * having no mock at all, because the swap to the gateway would then look like a
 * gateway bug.
 */

import type { Money, Role } from "@/types/common.api.type"
import type { Game, GameState, Ownership } from "@/types/catalog.api.type"
import type {
  InstalmentPlan,
  Order,
  OrderState,
  OrderType,
} from "@/types/order.api.type"
import type { LedgerEntry, Wallet } from "@/types/wallet.api.type"
import type {
  Notification,
  NotificationKind,
} from "@/types/notification.api.type"
import type { UserState, UserSummary } from "@/types/auth.api.type"

const CURRENCY = "IRR"
const PLATFORM_SHARE_BPS = 3000
const REFUND_WINDOW_HOURS = 12
const GIFT_MESSAGE_FEE_BPS = 200

export const CURRENT_USER_ID = "11111111-1111-4111-8111-111111111111"

function minor(major: number): Money {
  return { amount_minor: String(BigInt(major) * 100n), currency: CURRENCY }
}

function money(amountMinor: bigint): Money {
  return { amount_minor: amountMinor.toString(), currency: CURRENCY }
}

function parse(m: Money): bigint {
  try {
    return BigInt(m.amount_minor)
  } catch {
    return 0n
  }
}

function share(total: bigint, bps: number): bigint {
  return (total * BigInt(bps)) / 10000n
}

let sequence = 1
function id(prefix: string): string {
  return `${prefix}-${String(sequence++).padStart(4, "0")}`
}

function iso(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString()
}

// --- games ----------------------------------------------------------------
//
// Cover art is referenced by `media_ref`, which in the real platform is a media
// service key the client exchanges for a signed URL. Here it points at a local
// SVG generated from the logo's own palette — see scripts/generate-covers.py.
// Local rather than remote stock art for two reasons: a storefront that cannot
// render without the network is a storefront that breaks in a demo, and art
// derived from the wordmark keeps the grid looking like one product. The shape of
// the field is unchanged either way.

interface Seed {
  title: string
  description: string
  genres: string[]
  price: number
  state: GameState
  cover: string
  discountBps?: number
  releaseInDays?: number
  developer: string
}

const SEEDS: Seed[] = [
  {
    title: "Neon Drift",
    description:
      "A race through the wet streets of a city with no name. You see each corner once, and you take it right the first time or not at all.",
    genres: ["Racing", "Indie"],
    price: 480_000,
    state: "PUBLISHED",
    cover: "/covers/neon-drift.svg",
    discountBps: 2500,
    developer: "dev-neon",
  },
  {
    title: "Hollow Signal",
    description:
      "An abandoned station in Saturn orbit. The signal you keep hearing might be your own voice, ten years from now.",
    genres: ["Adventure", "Mystery"],
    price: 720_000,
    state: "PUBLISHED",
    cover: "/covers/hollow-signal.svg",
    developer: "dev-hollow",
  },
  {
    title: "Paper Kingdoms",
    description:
      "Turn-based strategy on a map drawn across folded paper. Every crease is a border, and folding is a move.",
    genres: ["Strategy", "Turn-based"],
    price: 350_000,
    state: "PUBLISHED",
    cover: "/covers/paper-kingdoms.svg",
    developer: "dev-paper",
  },
  {
    title: "Iron Bloom",
    description:
      "A garden watered with iron. Build it, defend it, and find out what grows when everything is a machine.",
    genres: ["Builder", "Survival"],
    price: 900_000,
    state: "PUBLISHED",
    cover: "/covers/iron-bloom.svg",
    discountBps: 4000,
    developer: "dev-iron",
  },
  {
    title: "Lantern Way",
    description:
      "A long walk with a lantern. A game about arriving somewhere, not about winning.",
    genres: ["Adventure", "Calm"],
    price: 0,
    state: "PUBLISHED",
    cover: "/covers/lantern-way.svg",
    developer: "dev-lantern",
  },
  {
    title: "Vault of Echoes",
    description:
      "A dungeon that remembers one more of its rooms every time you die in it.",
    genres: ["Roguelike", "Action"],
    price: 620_000,
    state: "PUBLISHED",
    cover: "/covers/vault-of-echoes.svg",
    developer: "dev-vault",
  },
  {
    title: "Starforge Tactics",
    description:
      "You build a fleet that makes its own decisions. All you write is the doctrine it fights by.",
    genres: ["Strategy", "Sci-fi"],
    price: 1_100_000,
    state: "PREORDER",
    releaseInDays: 24,
    cover: "/covers/starforge-tactics.svg",
    developer: "dev-starforge",
  },
  {
    title: "Tide & Tally",
    description:
      "A small port and a very large ledger. Bookkeeping turns out to be less forgiving than war.",
    genres: ["Management", "Indie"],
    price: 410_000,
    state: "PREORDER",
    releaseInDays: 9,
    cover: "/covers/tide-and-tally.svg",
    developer: "dev-tide",
  },
]

function buildGame(seed: Seed): Game {
  const price = minor(seed.price)
  const gameId = id("game")
  const discount = seed.discountBps ?? 0
  const effective =
    discount > 0 ? money(parse(price) - share(parse(price), discount)) : price

  return {
    id: gameId,
    developer_id: seed.developer,
    title: seed.title,
    description: seed.description,
    min_requirements: "8 GB RAM, 4 GB graphics card, 60 GB free space",
    state: seed.state,
    genres: seed.genres,
    tags: [],
    suggested_price: price,
    final_price: price,
    teaser_ref: "",
    effective_price: effective,
    discount_bps: discount,
    withdrawn_at: null,
    withdrawal_reason: "",
    release_at:
      seed.releaseInDays === undefined
        ? null
        : iso(seed.releaseInDays * 24 * 60),
    versions: [
      {
        id: id("ver"),
        version: "1.0.0",
        file_ref: `${gameId}/1.0.0`,
        size_bytes: 4_200_000_000,
        uploaded_at: iso(-60 * 24 * 30),
        notes: "",
      },
    ],
    media: [
      { id: id("med"), kind: "COVER", media_ref: seed.cover, position: 0 },
    ],
    created_at: iso(-60 * 24 * 60),
    updated_at: iso(-60 * 24 * 3),
    published_at: seed.state === "PUBLISHED" ? iso(-60 * 24 * 20) : null,
  }
}

// --- the store -------------------------------------------------------------

interface Store {
  user: UserSummary
  games: Game[]
  ownerships: Ownership[]
  orders: Order[]
  plans: InstalmentPlan[]
  wallet: Wallet
  ledger: LedgerEntry[]
  notifications: Notification[]
  signedIn: boolean
}

function initialStore(): Store {
  const games = SEEDS.map(buildGame)
  const balance = minor(3_500_000)

  return {
    user: {
      user_id: CURRENT_USER_ID,
      email: "player@arcadia.local",
      display_name: "Guest player",
      role: "BASIC_USER" as Role,
      state: "ACTIVE" as UserState,
    },
    games,
    ownerships: [],
    orders: [],
    plans: [],
    wallet: {
      id: id("wal"),
      user_id: CURRENT_USER_ID,
      balance,
      held: minor(0),
      available: balance,
      status: "ACTIVE",
      version: 1,
      created_at: iso(-60 * 24 * 90),
      updated_at: iso(-60),
    },
    ledger: [
      {
        id: id("led"),
        sequence: 1,
        wallet_id: "wal-0001",
        direction: "CREDIT",
        amount: balance,
        balance_after: balance,
        reason: "ADMIN_ADJUSTMENT",
        description: "Opening balance for the demo account",
        created_at: iso(-60 * 24 * 30),
      },
    ],
    notifications: [],
    signedIn: true,
  }
}

export const db: Store = initialStore()

export function resetDb(): void {
  Object.assign(db, initialStore())
}

// --- the rules -------------------------------------------------------------

export function ownedGameIds(): Set<string> {
  return new Set(
    db.ownerships.filter((o) => o.status === "ACTIVE").map((o) => o.game_id)
  )
}

export function priceOf(game: Game): Money {
  return game.effective_price ?? game.final_price ?? minor(0)
}

export class MockRuleError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string
  ) {
    super(message)
  }
}

function notify(
  kind: NotificationKind,
  title: string,
  body: string,
  subject: {
    type: Notification["subject_type"]
    id: string
  }
): void {
  db.notifications.unshift({
    id: id("note"),
    kind,
    title,
    body,
    subject_type: subject.type,
    subject_id: subject.id,
    read: false,
    created_at: iso(),
    read_at: null,
  })
}

function debit(
  amount: Money,
  reason: string,
  referenceId: string,
  description: string
): void {
  const balance = parse(db.wallet.balance)
  const value = parse(amount)
  if (value > balance - parse(db.wallet.held)) {
    throw new MockRuleError(409, "INSUFFICIENT_FUNDS", "Not enough balance")
  }
  const after = balance - value
  db.wallet.balance = money(after)
  db.wallet.available = money(after - parse(db.wallet.held))
  db.wallet.version += 1
  db.wallet.updated_at = iso()
  db.ledger.unshift({
    id: id("led"),
    sequence: db.ledger.length + 1,
    wallet_id: db.wallet.id,
    direction: "DEBIT",
    amount,
    balance_after: money(after),
    reason,
    reference_id: referenceId,
    description,
    created_at: iso(),
  })
}

function credit(
  amount: Money,
  reason: string,
  referenceId: string,
  description: string
): void {
  const after = parse(db.wallet.balance) + parse(amount)
  db.wallet.balance = money(after)
  db.wallet.available = money(after - parse(db.wallet.held))
  db.wallet.version += 1
  db.wallet.updated_at = iso()
  db.ledger.unshift({
    id: id("led"),
    sequence: db.ledger.length + 1,
    wallet_id: db.wallet.id,
    direction: "CREDIT",
    amount,
    balance_after: money(after),
    reason,
    reference_id: referenceId,
    description,
    created_at: iso(),
  })
}

function grant(game: Game, orderId: string, giftedBy = ""): void {
  db.ownerships.unshift({
    id: id("own"),
    game_id: game.id,
    owner_id: CURRENT_USER_ID,
    order_id: orderId,
    status: "ACTIVE",
    granted_at: iso(),
    revoked_at: null,
    gifted_by: giftedBy,
  })
}

function newOrder(
  game: Game,
  type: OrderType,
  state: OrderState,
  charged: Money
): Order {
  const total = parse(charged)
  return {
    id: id("order"),
    buyer_id: CURRENT_USER_ID,
    game_id: game.id,
    game_title: game.title,
    developer_id: game.developer_id,
    type,
    state,
    base_price: game.final_price ?? minor(0),
    total_charged: charged,
    developer_share: money(total - share(total, PLATFORM_SHARE_BPS)),
    platform_share: money(share(total, PLATFORM_SHARE_BPS)),
    discount: null,
    discount_code: "",
    gift: null,
    failure_reason: "",
    failure_message: "",
    created_at: iso(),
    completed_at: state === "COMPLETED" ? iso() : null,
    refunded_at: null,
    refundable_until:
      state === "COMPLETED" ? iso(REFUND_WINDOW_HOURS * 60) : null,
    cancellable: state === "RESERVED",
    saga: null,
    idempotent_replay: false,
  }
}

export function buy(gameId: string): Order {
  const game = db.games.find((g) => g.id === gameId)
  if (!game) throw new MockRuleError(404, "NOT_FOUND", "No such game")
  if (ownedGameIds().has(gameId)) {
    throw new MockRuleError(409, "ALREADY_OWNED", "You already own this game")
  }
  if (game.state !== "PUBLISHED") {
    throw new MockRuleError(409, "NOT_FOR_SALE", "This game is not on sale")
  }

  const price = priceOf(game)
  if (parse(price) > 0n) {
    debit(price, "PURCHASE", game.id, `Purchase of ${game.title}`)
  }
  const order = newOrder(game, "PURCHASE", "COMPLETED", price)
  db.orders.unshift(order)
  grant(game, order.id)
  notify("PURCHASE_COMPLETED", `${game.title} is in your library`, "", {
    type: "ORDER",
    id: order.id,
  })
  return order
}

export function gift(
  gameId: string,
  recipientId: string,
  message: string
): Order {
  const game = db.games.find((g) => g.id === gameId)
  if (!game) throw new MockRuleError(404, "NOT_FOUND", "No such game")
  if (game.state !== "PUBLISHED") {
    throw new MockRuleError(409, "NOT_FOR_SALE", "This game is not on sale")
  }

  const price = parse(priceOf(game))
  // Requirement 1.4's surcharge: a gift message costs 2% of the price.
  const fee = message.trim() ? share(price, GIFT_MESSAGE_FEE_BPS) : 0n
  const charged = money(price + fee)
  debit(charged, "PURCHASE", game.id, `Gift of ${game.title}`)

  const order = newOrder(game, "GIFT", "COMPLETED", charged)
  order.gift = {
    recipient_id: recipientId,
    message,
    message_fee: fee > 0n ? money(fee) : null,
  }
  db.orders.unshift(order)
  notify("PURCHASE_COMPLETED", `Your gift of ${game.title} was delivered`, "", {
    type: "ORDER",
    id: order.id,
  })
  return order
}

export function refund(orderId: string): Order {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) throw new MockRuleError(404, "NOT_FOUND", "No such order")
  if (order.state !== "COMPLETED") {
    throw new MockRuleError(
      409,
      "NOT_REFUNDABLE",
      "This order cannot be refunded"
    )
  }
  if (
    order.refundable_until &&
    new Date(order.refundable_until).getTime() < Date.now()
  ) {
    throw new MockRuleError(
      409,
      "REFUND_WINDOW_CLOSED",
      "The refund window has closed"
    )
  }

  credit(
    order.total_charged,
    "REFUND",
    order.id,
    `Refund for ${order.game_title}`
  )
  order.state = "REFUNDED"
  order.refunded_at = iso()

  const ownership = db.ownerships.find((o) => o.order_id === order.id)
  if (ownership) {
    ownership.status = "REVOKED"
    ownership.revoked_at = iso()
  }
  notify(
    "ORDER_REFUNDED",
    `${order.game_title} refunded`,
    "The money is back in your wallet and the game has been removed.",
    {
      type: "ORDER",
      id: order.id,
    }
  )
  return order
}

export function topUp(amount: Money): Wallet {
  if (parse(amount) <= 0n) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "The amount must be greater than zero"
    )
  }
  credit(amount, "TOP_UP", id("pay"), "Wallet top-up")
  return db.wallet
}

export function startInstalmentPlan(
  gameId: string,
  instalments: number,
  intervalDays: number
): { order: Order; plan: InstalmentPlan } {
  const game = db.games.find((g) => g.id === gameId)
  if (!game) throw new MockRuleError(404, "NOT_FOUND", "No such game")
  if (instalments < 2) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "An instalment plan needs at least two payments"
    )
  }
  if (ownedGameIds().has(gameId)) {
    throw new MockRuleError(409, "ALREADY_OWNED", "You already own this game")
  }

  const total = parse(priceOf(game))
  const per = total / BigInt(instalments)
  // The last instalment carries the remainder, so the parts always sum to the price.
  const last = total - per * BigInt(instalments - 1)

  debit(
    money(per),
    "PURCHASE",
    game.id,
    `Payment 1 of ${instalments} — ${game.title}`
  )

  const order = newOrder(game, "INSTALMENT", "PAYING", money(total))
  order.completed_at = null
  order.refundable_until = null
  db.orders.unshift(order)
  grant(game, order.id)

  const plan: InstalmentPlan = {
    id: id("plan"),
    order_id: order.id,
    buyer_id: CURRENT_USER_ID,
    game_id: game.id,
    state: "PAYING",
    total: money(total),
    paid: money(per),
    outstanding: money(total - per),
    grace_days: 7,
    deadline: iso(instalments * intervalDays * 24 * 60),
    next_due_at: iso(intervalDays * 24 * 60),
    defaults_at: iso((intervalDays + 7) * 24 * 60),
    instalments: Array.from({ length: instalments }, (_, index) => ({
      number: index + 1,
      of_total: instalments,
      amount: money(index === instalments - 1 ? last : per),
      due_at: iso(index * intervalDays * 24 * 60),
      state: index === 0 ? "PAID" : index === 1 ? "DUE" : "SCHEDULED",
      paid_at: index === 0 ? iso() : null,
    })),
    created_at: iso(),
  }
  db.plans.unshift(plan)

  notify(
    "INSTALMENT_PLAN_STARTED",
    `Your payment plan has started — ${instalments} payments`,
    "The game is in your library already.",
    { type: "INSTALMENT_PLAN", id: plan.id }
  )
  return { order, plan }
}

export function preorder(gameId: string): Order {
  const game = db.games.find((g) => g.id === gameId)
  if (!game) throw new MockRuleError(404, "NOT_FOUND", "No such game")
  if (game.state !== "PREORDER") {
    throw new MockRuleError(
      409,
      "NOT_FOR_SALE",
      "This game is not open for pre-order"
    )
  }

  const price = priceOf(game)
  const value = parse(price)
  if (value > parse(db.wallet.available)) {
    throw new MockRuleError(409, "INSUFFICIENT_FUNDS", "Not enough balance")
  }
  // A pre-order holds the money rather than spending it: committed, not gone.
  db.wallet.held = money(parse(db.wallet.held) + value)
  db.wallet.available = money(parse(db.wallet.balance) - parse(db.wallet.held))
  db.wallet.updated_at = iso()

  const order = newOrder(game, "PREORDER", "RESERVED", price)
  order.completed_at = null
  order.refundable_until = null
  order.cancellable = true
  db.orders.unshift(order)
  return order
}
