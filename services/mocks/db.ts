/**
 * The stand-in backend.
 *
 * Deliberately more than a folder of static JSON. It keeps state across reloads
 * and enforces the rules the real services enforce, so the UI is built against
 * behaviour rather than against a happy path:
 *
 *  - buying debits the wallet, and fails when the balance is short
 *  - buying twice is refused, because the library already holds it
 *  - a purchase writes a ledger entry and a notification, like the real fan-out
 *  - a refund is refused once the twelve-hour window has closed
 *  - `effective_price` is derived from a live promotion, never stored twice
 *  - the publishing workflow is a state machine, and an illegal transition is a
 *    409 rather than a silent no-op
 *
 * Every field name and enum value matches the service it stands for — those came
 * from the services' own DTOs. Getting a name wrong here would be worse than
 * having no mock at all, because the swap to the gateway would then look like a
 * gateway bug. That is not hypothetical: the notification service shipped with two
 * wrong field names for exactly this reason.
 */

import { ls } from "@/lib/local-storage"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import type { Money, Role } from "@/types/common.api.type"
import type {
  Game,
  GameReview,
  GameState,
  Ownership,
  Promotion,
} from "@/types/catalog.api.type"
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
import type { UserSummary } from "@/types/auth.api.type"

import {
  CURRENCY,
  DEVELOPER_ID,
  GIFT_MESSAGE_FEE_BPS,
  OPENING_BALANCE,
  PLATFORM_SHARE_BPS,
  PLAYER_ID,
  REFUND_WINDOW_HOURS,
  SEED_GAMES,
  SEED_ROLE_REQUESTS,
  SEED_USERS,
  SUPPORT_ID,
  type GameSeed,
  type SeedUser,
} from "./seed"

// --- helpers ---------------------------------------------------------------

export function minor(major: number): Money {
  return { amount_minor: String(BigInt(major) * 100n), currency: CURRENCY }
}

export function money(amountMinor: bigint): Money {
  return { amount_minor: amountMinor.toString(), currency: CURRENCY }
}

export function parse(m: Money | null | undefined): bigint {
  if (!m) return 0n
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

export class MockRuleError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string
  ) {
    super(message)
  }
}

// --- shapes ----------------------------------------------------------------

export interface MockUser extends UserSummary {
  password: string
}

export interface RoleRequest {
  request_id: string
  user_id: string
  display_name: string
  email: string
  requested_role: Role
  status: string
  note: string
  created_at: string
}

interface Store {
  users: MockUser[]
  /** Who is signed in. Null before sign-in and after sign-out. */
  sessionUserId: string | null
  games: Game[]
  ownerships: Ownership[]
  orders: Order[]
  plans: InstalmentPlan[]
  wallets: Record<string, Wallet>
  ledgers: Record<string, LedgerEntry[]>
  notifications: Record<string, Notification[]>
  roleRequests: RoleRequest[]
  reviews: Record<string, GameReview[]>
  promotions: Record<string, Promotion[]>
}

// --- seeding ---------------------------------------------------------------

function buildGame(seed: GameSeed): Game {
  const price = minor(seed.price)
  const gameId = id("game")
  const discount = seed.discountBps ?? 0
  const priced = seed.state === "PUBLISHED" || seed.state === "PREORDER"
  const effective =
    priced && discount > 0
      ? money(parse(price) - share(parse(price), discount))
      : price

  return {
    id: gameId,
    developer_id: seed.developer,
    title: seed.title,
    description: seed.description,
    min_requirements: "8 GB RAM, 4 GB graphics card, 60 GB free space",
    state: seed.state,
    genres: seed.genres,
    tags: [],
    suggested_price: seed.suggestedPrice ? minor(seed.suggestedPrice) : null,
    final_price: priced ? price : null,
    teaser_ref: "",
    effective_price: priced ? effective : null,
    discount_bps: priced ? discount : 0,
    withdrawn_at: null,
    withdrawal_reason: "",
    release_at:
      seed.releaseInDays === undefined
        ? null
        : iso(seed.releaseInDays * 24 * 60),
    versions:
      seed.state === "DRAFT"
        ? []
        : [
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

function newWallet(
  userId: string,
  opening: number
): { wallet: Wallet; ledger: LedgerEntry[] } {
  const balance = minor(opening)
  const walletId = id("wal")
  return {
    wallet: {
      id: walletId,
      user_id: userId,
      balance,
      held: minor(0),
      available: balance,
      status: "ACTIVE",
      version: 1,
      created_at: iso(-60 * 24 * 90),
      updated_at: iso(-60),
    },
    ledger:
      opening > 0
        ? [
            {
              id: id("led"),
              sequence: 1,
              wallet_id: walletId,
              direction: "CREDIT",
              amount: balance,
              balance_after: balance,
              reason: "ADMIN_ADJUSTMENT",
              description: "Opening balance for the demo account",
              created_at: iso(-60 * 24 * 30),
            },
          ]
        : [],
  }
}

function toUser(seed: SeedUser): MockUser {
  return {
    user_id: seed.user_id,
    email: seed.email,
    display_name: seed.display_name,
    role: seed.role,
    state: seed.state,
    password: seed.password,
  }
}

function initialStore(): Store {
  sequence = 1
  const games = SEED_GAMES.map(buildGame)
  const users = SEED_USERS.map(toUser)

  const wallets: Record<string, Wallet> = {}
  const ledgers: Record<string, LedgerEntry[]> = {}
  for (const user of users) {
    // Only the two accounts that spend money start with any.
    const opening =
      user.user_id === PLAYER_ID || user.user_id === DEVELOPER_ID
        ? OPENING_BALANCE
        : 0
    const made = newWallet(user.user_id, opening)
    wallets[user.user_id] = made.wallet
    ledgers[user.user_id] = made.ledger
  }

  // The review conversation on the game that was already approved, so the
  // developer's history is not blank on first run.
  const reviews: Record<string, GameReview[]> = {}
  const approved = games.find((game) => game.state === "APPROVED")
  if (approved) {
    reviews[approved.id] = [
      {
        id: id("rev"),
        support_id: SUPPORT_ID,
        decision: "APPROVED",
        note: "Content policy check passed. Nice work on the accessibility options.",
        at: iso(-60 * 24 * 2),
        appealed: false,
        appeal_note: "",
      },
    ]
  }

  return {
    users,
    sessionUserId: null,
    games,
    ownerships: [],
    orders: [],
    plans: [],
    wallets,
    ledgers,
    notifications: Object.fromEntries(users.map((user) => [user.user_id, []])),
    roleRequests: SEED_ROLE_REQUESTS.map((seed) => ({
      request_id: seed.request_id,
      user_id: seed.user_id,
      display_name: seed.display_name,
      email: seed.email,
      requested_role: seed.requested_role,
      status: seed.status,
      note: "",
      created_at: iso(-seed.created_at_minutes_ago),
    })),
    reviews,
    promotions: {},
  }
}

// --- persistence -----------------------------------------------------------
//
// Survives a reload, because a mock that resets on every refresh makes the app
// impossible to demonstrate: you buy a game, reload to check the library, and the
// purchase is gone. The version means changing the seed starts fresh rather than
// leaving a half-migrated shape in somebody's browser.

const SNAPSHOT_VERSION = 1

interface Snapshot {
  version: number
  sequence: number
  store: Store
}

function load(): Store {
  const saved = ls.get<Snapshot | null>(STORAGE_KEYS.mockDb, null)
  if (saved && saved.version === SNAPSHOT_VERSION) {
    sequence = saved.sequence
    return saved.store
  }
  return initialStore()
}

export const db: Store = load()

export function save(): void {
  ls.set(STORAGE_KEYS.mockDb, {
    version: SNAPSHOT_VERSION,
    sequence,
    store: db,
  })
}

export function resetDb(): void {
  Object.assign(db, initialStore())
  save()
}

// --- session ---------------------------------------------------------------

export function currentUser(): MockUser {
  const user = db.users.find(
    (candidate) => candidate.user_id === db.sessionUserId
  )
  if (!user) throw new MockRuleError(401, "TOKEN_MISSING", "Not signed in")
  return user
}

export function requireRole(...roles: Role[]): MockUser {
  const user = currentUser()
  if (!roles.includes(user.role)) {
    throw new MockRuleError(403, "ROLE_REQUIRED", "Your role cannot do that")
  }
  return user
}

export function signIn(email: string, password: string): MockUser {
  const user = db.users.find(
    (candidate) => candidate.email === email.trim().toLowerCase()
  )
  if (!user || user.password !== password) {
    throw new MockRuleError(
      401,
      "INVALID_CREDENTIALS",
      "That email and password do not match"
    )
  }
  // Requirement 1.1: an account waits for an administrator before it can sign in.
  if (user.state === "PENDING") {
    throw new MockRuleError(
      403,
      "ACCOUNT_PENDING",
      "This account is waiting for an administrator to approve it"
    )
  }
  if (user.state === "REJECTED") {
    throw new MockRuleError(
      403,
      "ACCOUNT_REJECTED",
      "This registration was not approved"
    )
  }
  if (user.state === "BANNED") {
    throw new MockRuleError(403, "ACCOUNT_BANNED", "This account is suspended")
  }
  db.sessionUserId = user.user_id
  save()
  return user
}

export function signOut(): void {
  db.sessionUserId = null
  save()
}

export function registerUser(
  email: string,
  password: string,
  displayName: string
): MockUser {
  const normalised = email.trim().toLowerCase()
  if (db.users.some((user) => user.email === normalised)) {
    throw new MockRuleError(
      409,
      "EMAIL_TAKEN",
      "An account with that email already exists"
    )
  }
  const user: MockUser = {
    user_id: crypto.randomUUID(),
    email: normalised,
    display_name: displayName.trim(),
    role: "BASIC_USER",
    // PENDING, not ACTIVE — and there is no token in the response either.
    // Registering is not signing in.
    state: "PENDING",
    password,
  }
  db.users.push(user)
  const made = newWallet(user.user_id, 0)
  db.wallets[user.user_id] = made.wallet
  db.ledgers[user.user_id] = made.ledger
  db.notifications[user.user_id] = []
  save()
  return user
}

/** A user without their password, which is the only shape that leaves this module.
 *  One helper rather than five destructures, each of which left an unused binding. */
function publicUser(user: MockUser): UserSummary {
  return {
    user_id: user.user_id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    state: user.state,
  }
}

export function userById(userId: string): UserSummary {
  const user = db.users.find((candidate) => candidate.user_id === userId)
  if (!user) throw new MockRuleError(404, "NOT_FOUND", "No such account")
  return publicUser(user)
}

// --- wallet ----------------------------------------------------------------

export function walletOf(userId: string): Wallet {
  const wallet = db.wallets[userId]
  if (!wallet)
    throw new MockRuleError(404, "NOT_FOUND", "No wallet for that account")
  return wallet
}

function recordEntry(
  userId: string,
  direction: "CREDIT" | "DEBIT",
  amount: Money,
  reason: string,
  referenceId: string,
  description: string
): void {
  const wallet = walletOf(userId)
  const ledger = db.ledgers[userId] ?? []
  ledger.unshift({
    id: id("led"),
    sequence: ledger.length + 1,
    wallet_id: wallet.id,
    direction,
    amount,
    balance_after: wallet.balance,
    reason,
    reference_id: referenceId,
    description,
    created_at: iso(),
  })
  db.ledgers[userId] = ledger
}

export function debit(
  userId: string,
  amount: Money,
  reason: string,
  referenceId: string,
  description: string
): void {
  const wallet = walletOf(userId)
  const value = parse(amount)
  if (value > parse(wallet.balance) - parse(wallet.held)) {
    throw new MockRuleError(409, "INSUFFICIENT_FUNDS", "Not enough balance")
  }
  wallet.balance = money(parse(wallet.balance) - value)
  wallet.available = money(parse(wallet.balance) - parse(wallet.held))
  wallet.version += 1
  wallet.updated_at = iso()
  recordEntry(userId, "DEBIT", amount, reason, referenceId, description)
}

export function credit(
  userId: string,
  amount: Money,
  reason: string,
  referenceId: string,
  description: string
): void {
  const wallet = walletOf(userId)
  wallet.balance = money(parse(wallet.balance) + parse(amount))
  wallet.available = money(parse(wallet.balance) - parse(wallet.held))
  wallet.version += 1
  wallet.updated_at = iso()
  recordEntry(userId, "CREDIT", amount, reason, referenceId, description)
}

export function topUp(amount: Money): Wallet {
  const user = currentUser()
  if (parse(amount) <= 0n) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "The amount must be greater than zero"
    )
  }
  credit(user.user_id, amount, "TOP_UP", id("pay"), "Wallet top-up")
  save()
  return walletOf(user.user_id)
}

// --- notifications ---------------------------------------------------------

export function notify(
  userId: string,
  kind: NotificationKind,
  title: string,
  body: string,
  subject: { type: Notification["subject_type"]; id: string }
): void {
  const list = db.notifications[userId] ?? []
  list.unshift({
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
  db.notifications[userId] = list
}

export function notificationsOf(userId: string): Notification[] {
  return db.notifications[userId] ?? []
}

// --- the storefront --------------------------------------------------------

export function ownedGameIds(userId: string): Set<string> {
  return new Set(
    db.ownerships
      .filter((entry) => entry.owner_id === userId && entry.status === "ACTIVE")
      .map((entry) => entry.game_id)
  )
}

export function priceOf(game: Game): Money {
  return game.effective_price ?? game.final_price ?? minor(0)
}

export function gameById(gameId: string): Game {
  const game = db.games.find((candidate) => candidate.id === gameId)
  if (!game) throw new MockRuleError(404, "NOT_FOUND", "No such game")
  return game
}

function grant(
  userId: string,
  game: Game,
  orderId: string,
  giftedBy = ""
): void {
  db.ownerships.unshift({
    id: id("own"),
    game_id: game.id,
    owner_id: userId,
    order_id: orderId,
    status: "ACTIVE",
    granted_at: iso(),
    revoked_at: null,
    gifted_by: giftedBy,
  })
}

function newOrder(
  buyerId: string,
  game: Game,
  type: OrderType,
  state: OrderState,
  charged: Money
): Order {
  const total = parse(charged)
  return {
    id: id("order"),
    buyer_id: buyerId,
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

/** The developer's 70% of a sale, credited the way the real saga credits it. */
function payDeveloper(game: Game, order: Order): void {
  if (!db.wallets[game.developer_id]) return
  credit(
    game.developer_id,
    order.developer_share,
    "REVENUE_SHARE",
    order.id,
    `Revenue share — ${game.title}`
  )
}

export function buy(gameId: string): Order {
  const user = currentUser()
  const game = gameById(gameId)
  if (ownedGameIds(user.user_id).has(gameId)) {
    throw new MockRuleError(409, "ALREADY_OWNED", "You already own this game")
  }
  if (game.state !== "PUBLISHED" || game.withdrawn_at) {
    throw new MockRuleError(409, "NOT_FOR_SALE", "This game is not on sale")
  }

  const price = priceOf(game)
  if (parse(price) > 0n) {
    debit(user.user_id, price, "PURCHASE", game.id, `Purchase of ${game.title}`)
  }
  const order = newOrder(user.user_id, game, "PURCHASE", "COMPLETED", price)
  db.orders.unshift(order)
  grant(user.user_id, game, order.id)
  payDeveloper(game, order)
  notify(
    user.user_id,
    "PURCHASE_COMPLETED",
    `${game.title} is in your library`,
    "",
    {
      type: "ORDER",
      id: order.id,
    }
  )
  save()
  return order
}

export function gift(
  gameId: string,
  recipientId: string,
  message: string
): Order {
  const user = currentUser()
  const game = gameById(gameId)
  if (game.state !== "PUBLISHED" || game.withdrawn_at) {
    throw new MockRuleError(409, "NOT_FOR_SALE", "This game is not on sale")
  }
  const recipient = db.users.find(
    (candidate) =>
      candidate.user_id === recipientId ||
      candidate.email === recipientId.trim().toLowerCase()
  )

  const price = parse(priceOf(game))
  // Requirement 1.4's surcharge: a gift message costs 2% of the price.
  const fee = message.trim() ? share(price, GIFT_MESSAGE_FEE_BPS) : 0n
  const charged = money(price + fee)
  debit(user.user_id, charged, "PURCHASE", game.id, `Gift of ${game.title}`)

  const order = newOrder(user.user_id, game, "GIFT", "COMPLETED", charged)
  order.gift = {
    recipient_id: recipient?.user_id ?? recipientId,
    message,
    message_fee: fee > 0n ? money(fee) : null,
  }
  db.orders.unshift(order)
  payDeveloper(game, order)

  // One event, two people, two different things to say.
  if (recipient) {
    grant(recipient.user_id, game, order.id, user.user_id)
    notify(
      recipient.user_id,
      "GIFT_RECEIVED",
      `You received ${game.title} as a gift`,
      message,
      {
        type: "ORDER",
        id: order.id,
      }
    )
  }
  notify(
    user.user_id,
    "PURCHASE_COMPLETED",
    `Your gift of ${game.title} was delivered`,
    "",
    {
      type: "ORDER",
      id: order.id,
    }
  )
  save()
  return order
}

export function refund(orderId: string): Order {
  const user = currentUser()
  const order = db.orders.find((candidate) => candidate.id === orderId)
  if (!order || order.buyer_id !== user.user_id) {
    throw new MockRuleError(404, "NOT_FOUND", "No such order")
  }
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
    user.user_id,
    order.total_charged,
    "REFUND",
    order.id,
    `Refund for ${order.game_title}`
  )
  order.state = "REFUNDED"
  order.refunded_at = iso()

  for (const ownership of db.ownerships.filter(
    (entry) => entry.order_id === order.id
  )) {
    ownership.status = "REVOKED"
    ownership.revoked_at = iso()
  }
  notify(
    user.user_id,
    "ORDER_REFUNDED",
    `${order.game_title} was refunded`,
    "The money is back in your wallet and the game has been removed.",
    { type: "ORDER", id: order.id }
  )
  save()
  return order
}

export function startInstalmentPlan(
  gameId: string,
  instalments: number,
  intervalDays: number
): { order: Order; plan: InstalmentPlan } {
  const user = currentUser()
  const game = gameById(gameId)
  if (instalments < 2) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "An instalment plan needs at least two payments"
    )
  }
  if (ownedGameIds(user.user_id).has(gameId)) {
    throw new MockRuleError(409, "ALREADY_OWNED", "You already own this game")
  }
  if (game.state !== "PUBLISHED" || game.withdrawn_at) {
    throw new MockRuleError(409, "NOT_FOR_SALE", "This game is not on sale")
  }

  const total = parse(priceOf(game))
  const per = total / BigInt(instalments)
  // The last instalment carries the remainder, so the parts always sum to the price.
  const last = total - per * BigInt(instalments - 1)

  debit(
    user.user_id,
    money(per),
    "PURCHASE",
    game.id,
    `Payment 1 of ${instalments} — ${game.title}`
  )

  const order = newOrder(
    user.user_id,
    game,
    "INSTALMENT",
    "PAYING",
    money(total)
  )
  order.completed_at = null
  order.refundable_until = null
  db.orders.unshift(order)
  grant(user.user_id, game, order.id)

  const plan: InstalmentPlan = {
    id: id("plan"),
    order_id: order.id,
    buyer_id: user.user_id,
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
    user.user_id,
    "INSTALMENT_PLAN_STARTED",
    `Your payment plan has started — ${instalments} payments`,
    "The game is in your library already.",
    { type: "INSTALMENT_PLAN", id: plan.id }
  )
  save()
  return { order, plan }
}

/**
 * Pay the next instalment now.
 *
 * The real service collects on a schedule, so there is no endpoint for this — it
 * exists here because a monthly cadence is not demonstrable and the alternative is
 * a screen whose main action can never be taken. The developer note on the order
 * page says so rather than implying the API has it.
 */
export function payNextInstalment(orderId: string): InstalmentPlan {
  const user = currentUser()
  const plan = db.plans.find((candidate) => candidate.order_id === orderId)
  if (!plan || plan.buyer_id !== user.user_id) {
    throw new MockRuleError(404, "NOT_FOUND", "This order has no payment plan")
  }
  const next = plan.instalments.find((item) => item.state !== "PAID")
  if (!next)
    throw new MockRuleError(
      409,
      "ALREADY_PAID",
      "Everything on this plan is paid"
    )

  const order = db.orders.find((candidate) => candidate.id === orderId)
  const game = gameById(plan.game_id)

  debit(
    user.user_id,
    next.amount,
    "PURCHASE",
    plan.id,
    `Payment ${next.number} of ${next.of_total} — ${game.title}`
  )
  next.state = "PAID"
  next.paid_at = iso()
  plan.paid = money(parse(plan.paid) + parse(next.amount))
  plan.outstanding = money(parse(plan.total) - parse(plan.paid))

  const remaining = plan.instalments.filter((item) => item.state !== "PAID")
  if (remaining.length === 0) {
    plan.state = "COMPLETED"
    plan.next_due_at = null
    if (order) {
      order.state = "COMPLETED"
      order.completed_at = iso()
    }
    notify(
      user.user_id,
      "INSTALMENT_PLAN_COMPLETED",
      "Your payment plan is paid off",
      "Nothing further will be taken.",
      { type: "INSTALMENT_PLAN", id: plan.id }
    )
  } else {
    remaining[0].state = "DUE"
    plan.next_due_at = remaining[0].due_at
    notify(
      user.user_id,
      "INSTALMENT_PAID",
      `Payment ${next.number} taken`,
      "",
      {
        type: "INSTALMENT_PLAN",
        id: plan.id,
      }
    )
  }
  save()
  return plan
}

export function preorder(gameId: string): Order {
  const user = currentUser()
  const game = gameById(gameId)
  if (game.state !== "PREORDER") {
    throw new MockRuleError(
      409,
      "NOT_FOR_SALE",
      "This game is not open for pre-order"
    )
  }

  const price = priceOf(game)
  const value = parse(price)
  const wallet = walletOf(user.user_id)
  if (value > parse(wallet.available)) {
    throw new MockRuleError(409, "INSUFFICIENT_FUNDS", "Not enough balance")
  }
  // A pre-order holds the money rather than spending it: committed, not gone.
  wallet.held = money(parse(wallet.held) + value)
  wallet.available = money(parse(wallet.balance) - parse(wallet.held))
  wallet.updated_at = iso()

  const order = newOrder(user.user_id, game, "PREORDER", "RESERVED", price)
  order.completed_at = null
  order.refundable_until = null
  order.cancellable = true
  db.orders.unshift(order)
  save()
  return order
}

// --- the publishing workflow ----------------------------------------------
//
// Requirement 1.3 as a state machine. Modelled rather than waved at, because the
// developer and support screens are only meaningful if an illegal transition is
// refused: "publish" on a game that has not been priced is a 409, not a no-op.

const ALLOWED: Record<GameState, GameState[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  REJECTED: ["APPEALED"],
  APPEALED: ["IN_REVIEW"],
  APPROVED: ["PRICED"],
  PRICED: ["PUBLISHED", "PREORDER"],
  PREORDER: ["PUBLISHED"],
  PUBLISHED: [],
}

function transition(game: Game, to: GameState): void {
  if (!ALLOWED[game.state].includes(to)) {
    throw new MockRuleError(
      409,
      "ILLEGAL_TRANSITION",
      `A game in ${game.state} cannot move to ${to}`
    )
  }
  game.state = to
  game.updated_at = iso()
}

function ownGame(gameId: string): Game {
  const user = currentUser()
  const game = gameById(gameId)
  if (game.developer_id !== user.user_id) {
    throw new MockRuleError(
      403,
      "FOREIGN_SUBJECT",
      "That game belongs to another developer"
    )
  }
  return game
}

export function myGames(): Game[] {
  const user = currentUser()
  return db.games.filter((game) => game.developer_id === user.user_id)
}

export function registerGame(input: {
  title: string
  description: string
  min_requirements: string
  genres: string[]
}): Game {
  const user = requireRole("DEVELOPER")
  const game: Game = {
    id: id("game"),
    developer_id: user.user_id,
    title: input.title.trim(),
    description: input.description.trim(),
    min_requirements: input.min_requirements.trim(),
    state: "DRAFT",
    genres: input.genres,
    tags: [],
    suggested_price: null,
    final_price: null,
    teaser_ref: "",
    effective_price: null,
    discount_bps: 0,
    withdrawn_at: null,
    withdrawal_reason: "",
    release_at: null,
    versions: [],
    media: [
      {
        id: id("med"),
        kind: "COVER",
        media_ref: "/covers/paper-kingdoms.svg",
        position: 0,
      },
    ],
    created_at: iso(),
    updated_at: iso(),
    published_at: null,
  }
  db.games.unshift(game)
  save()
  return game
}

export function addVersion(
  gameId: string,
  version: string,
  sizeBytes: number
): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  if (game.versions.some((item) => item.version === version.trim())) {
    throw new MockRuleError(
      409,
      "VERSION_EXISTS",
      "That version already exists"
    )
  }
  game.versions.push({
    id: id("ver"),
    version: version.trim(),
    file_ref: `${game.id}/${version.trim()}`,
    size_bytes: sizeBytes,
    uploaded_at: iso(),
    notes: "",
  })
  game.updated_at = iso()
  save()
  return game
}

export function submitGame(gameId: string): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  // The rule that makes the state machine worth having: there is nothing to
  // review without a build.
  if (game.versions.length === 0) {
    throw new MockRuleError(
      409,
      "NO_VERSION",
      "Add a build before submitting for review"
    )
  }
  transition(game, "SUBMITTED")
  save()
  return game
}

export function startReview(gameId: string): Game {
  requireRole("SUPPORT", "ADMIN")
  const game = gameById(gameId)
  transition(game, "IN_REVIEW")
  save()
  return game
}

function addReview(
  game: Game,
  decision: string,
  note: string,
  appealed = false
): void {
  const user = currentUser()
  const list = db.reviews[game.id] ?? []
  list.push({
    id: id("rev"),
    support_id: user.user_id,
    decision,
    note,
    at: iso(),
    appealed,
    appeal_note: "",
  })
  db.reviews[game.id] = list
}

export function approveGame(gameId: string, note: string): Game {
  requireRole("SUPPORT", "ADMIN")
  const game = gameById(gameId)
  transition(game, "APPROVED")
  addReview(game, "APPROVED", note)
  notify(
    game.developer_id,
    "GAME_APPROVED",
    `${game.title} was approved`,
    "You can now set its final price and publish it.",
    { type: "GAME", id: game.id }
  )
  save()
  return game
}

export function rejectGame(gameId: string, note: string): Game {
  requireRole("SUPPORT", "ADMIN")
  // A rejection with no reason is unactionable, so the catalog requires one.
  if (!note.trim()) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "A rejection has to say why"
    )
  }
  const game = gameById(gameId)
  transition(game, "REJECTED")
  addReview(game, "REJECTED", note)
  notify(
    game.developer_id,
    "GAME_REJECTED",
    `${game.title} was not approved`,
    note,
    {
      type: "GAME",
      id: game.id,
    }
  )
  save()
  return game
}

export function appealGame(gameId: string, note: string): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  transition(game, "APPEALED")
  addReview(game, "APPEALED", note, true)
  save()
  return game
}

export function suggestPrice(gameId: string, amountMinor: number): Game {
  requireRole("SUPPORT", "ADMIN")
  const game = gameById(gameId)
  game.suggested_price = money(BigInt(amountMinor))
  game.updated_at = iso()
  save()
  return game
}

export function setFinalPrice(gameId: string, amountMinor: number): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  if (amountMinor < 0) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "A price cannot be negative"
    )
  }
  const price = money(BigInt(amountMinor))
  game.final_price = price
  game.effective_price = price
  if (game.state === "APPROVED") transition(game, "PRICED")
  game.updated_at = iso()
  save()
  return game
}

export function publishGame(gameId: string): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  if (game.final_price === null) {
    throw new MockRuleError(409, "NOT_PRICED", "Set a price before publishing")
  }
  transition(game, "PUBLISHED")
  game.published_at = iso()
  save()
  return game
}

export function withdrawGame(gameId: string, reason: string): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  if (game.state !== "PUBLISHED" && game.state !== "PREORDER") {
    throw new MockRuleError(409, "NOT_ON_SALE", "This game is not on sale")
  }
  game.withdrawn_at = iso()
  game.withdrawal_reason = reason
  game.updated_at = iso()
  save()
  return game
}

export function relistGame(gameId: string): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  game.withdrawn_at = null
  game.withdrawal_reason = ""
  game.updated_at = iso()
  save()
  return game
}

export function reviewQueue(): Game[] {
  requireRole("SUPPORT", "ADMIN")
  return db.games.filter(
    (game) =>
      game.state === "SUBMITTED" ||
      game.state === "IN_REVIEW" ||
      game.state === "APPEALED"
  )
}

export function reviewsOf(gameId: string): GameReview[] {
  return db.reviews[gameId] ?? []
}

// --- promotions ------------------------------------------------------------

export function promotionsOf(gameId: string): Promotion[] {
  return db.promotions[gameId] ?? []
}

export function proposePromotion(
  gameId: string,
  discountBps: number,
  startsAt: string,
  endsAt: string,
  note: string
): Promotion {
  const user = requireRole("SUPPORT", "ADMIN")
  const game = gameById(gameId)
  if (discountBps < 1 || discountBps > 10000) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "A discount is between 1 and 10000 bps"
    )
  }
  const promotion: Promotion = {
    id: id("promo"),
    game_id: gameId,
    discount_bps: discountBps,
    percent_off: discountBps / 100,
    state: "PROPOSED",
    starts_at: startsAt,
    ends_at: endsAt,
    live: false,
    proposed_by: user.user_id,
    festival_id: "",
    note,
    decided_by: "",
    decision_note: "",
    created_at: iso(),
  }
  db.promotions[gameId] = [...promotionsOf(gameId), promotion]

  // Requirement 1.9 makes the developer's approval necessary, so a proposal
  // nobody tells them about is a discount that silently never happens.
  notify(
    game.developer_id,
    "PROMOTION_PROPOSED",
    `${discountBps / 100}% off ${game.title} is waiting for your approval`,
    "Support proposed this discount. It does not start until you approve it.",
    { type: "GAME", id: gameId }
  )
  save()
  return promotion
}

export function decidePromotion(
  gameId: string,
  promotionId: string,
  approve: boolean
): Promotion {
  const user = requireRole("DEVELOPER")
  const game = ownGame(gameId)
  const promotion = promotionsOf(gameId).find(
    (candidate) => candidate.id === promotionId
  )
  if (!promotion) throw new MockRuleError(404, "NOT_FOUND", "No such promotion")
  if (promotion.state !== "PROPOSED") {
    throw new MockRuleError(
      409,
      "ALREADY_DECIDED",
      "That promotion has already been decided"
    )
  }

  promotion.state = approve ? "ACTIVE" : "REJECTED"
  promotion.decided_by = user.user_id
  promotion.live = approve
  if (approve && game.final_price) {
    game.discount_bps = promotion.discount_bps
    game.effective_price = money(
      parse(game.final_price) -
        share(parse(game.final_price), promotion.discount_bps)
    )
  }
  game.updated_at = iso()
  save()
  return promotion
}

// --- users and roles -------------------------------------------------------

export function allUsers(): UserSummary[] {
  requireRole("ADMIN", "SUPPORT")
  return db.users.map(publicUser)
}

export function decideRegistration(
  userId: string,
  approve: boolean
): UserSummary {
  requireRole("ADMIN")
  const user = db.users.find((candidate) => candidate.user_id === userId)
  if (!user) throw new MockRuleError(404, "NOT_FOUND", "No such account")
  if (user.state !== "PENDING") {
    throw new MockRuleError(
      409,
      "NOT_PENDING",
      "That account is not waiting for a decision"
    )
  }
  user.state = approve ? "ACTIVE" : "REJECTED"
  notify(
    user.user_id,
    approve ? "REGISTRATION_APPROVED" : "REGISTRATION_REJECTED",
    approve ? "Your account is active" : "Your registration was not approved",
    approve ? "You can sign in now." : "No reason was recorded.",
    { type: "ACCOUNT", id: user.user_id }
  )
  save()
  return publicUser(user)
}

export function grantRole(userId: string, newRole: Role): UserSummary {
  requireRole("ADMIN")
  const user = db.users.find((candidate) => candidate.user_id === userId)
  if (!user) throw new MockRuleError(404, "NOT_FOUND", "No such account")
  user.role = newRole
  if (!db.wallets[user.user_id]) {
    const made = newWallet(user.user_id, 0)
    db.wallets[user.user_id] = made.wallet
    db.ledgers[user.user_id] = made.ledger
  }
  notify(
    user.user_id,
    "ROLE_GRANTED",
    `You are now a ${newRole.toLowerCase().replace(/_/g, " ")}`,
    "Sign in again to pick up your new permissions.",
    { type: "ACCOUNT", id: user.user_id }
  )
  save()
  return publicUser(user)
}

export function setBanned(
  userId: string,
  banned: boolean,
  reason: string
): UserSummary {
  requireRole("ADMIN")
  const user = db.users.find((candidate) => candidate.user_id === userId)
  if (!user) throw new MockRuleError(404, "NOT_FOUND", "No such account")
  user.state = banned ? "BANNED" : "ACTIVE"
  notify(
    user.user_id,
    banned ? "ACCOUNT_BANNED" : "ACCOUNT_UNBANNED",
    banned
      ? "Your account has been suspended"
      : "Your account has been restored",
    banned
      ? reason || "Contact support for details."
      : "You can sign in again.",
    { type: "ACCOUNT", id: user.user_id }
  )
  save()
  return publicUser(user)
}

export function requestRole(requestedRole: Role): RoleRequest {
  const user = currentUser()
  if (
    db.roleRequests.some(
      (r) => r.user_id === user.user_id && r.status === "PENDING"
    )
  ) {
    throw new MockRuleError(
      409,
      "REQUEST_PENDING",
      "You already have a request waiting"
    )
  }
  const request: RoleRequest = {
    request_id: id("req"),
    user_id: user.user_id,
    display_name: user.display_name,
    email: user.email,
    requested_role: requestedRole,
    status: "PENDING",
    note: "",
    created_at: iso(),
  }
  db.roleRequests.unshift(request)
  save()
  return request
}

export function roleRequests(): RoleRequest[] {
  requireRole("ADMIN", "SUPPORT")
  return db.roleRequests
}

export function decideRoleRequest(
  requestId: string,
  approve: boolean,
  note: string
): RoleRequest {
  requireRole("ADMIN")
  const request = db.roleRequests.find(
    (candidate) => candidate.request_id === requestId
  )
  if (!request) throw new MockRuleError(404, "NOT_FOUND", "No such request")
  if (request.status !== "PENDING") {
    throw new MockRuleError(
      409,
      "ALREADY_DECIDED",
      "That request has already been decided"
    )
  }
  request.status = approve ? "APPROVED" : "REJECTED"
  request.note = note
  if (approve) grantRole(request.user_id, request.requested_role)
  save()
  return request
}
