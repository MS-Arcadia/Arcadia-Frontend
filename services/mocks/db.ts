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
 *  - a refund is refused once the twelve-hour window has closed, and a gift
 *    cannot be refunded at all — the game is already in somebody else's library
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
import type {
  ChargeResult,
  LedgerEntry,
  RedeemGiftCardResult,
  Wallet,
} from "@/types/wallet.api.type"
import type {
  Notification,
  NotificationKind,
} from "@/types/notification.api.type"
import type { PublicProfile, UserSummary } from "@/types/auth.api.type"
import type {
  BookDepth,
  BookView,
  Holding,
  MarketItem,
  MarketOrder,
  OrderSide,
  Trade,
} from "@/types/marketplace.api.type"
import {
  MAX_REVIEW_WORDS,
  type Review,
  type ReviewSentiment,
  type ReviewSortBy,
  type SortOrder,
} from "@/types/review.api.type"
import type {
  FestivalDetailView,
  FestivalGameView,
  FestivalView,
  PromotionSnapshotView,
} from "@/types/festival.api.type"
import {
  REACTION_EMOJI,
  type Comment,
  type FeedSort,
  type Post,
  type Report,
  type ResolutionAction,
} from "@/types/community.api.type"

import {
  ADMIN_ID,
  CURRENCY,
  DEVELOPER_ID,
  GIFT_MESSAGE_FEE_BPS,
  OPENING_BALANCE,
  PLATFORM_SHARE_BPS,
  PLAYER_ID,
  REFUND_WINDOW_HOURS,
  SEED_FESTIVALS,
  SEED_GAMES,
  SEED_MARKET_ITEMS,
  SEED_POSTS,
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
  /** Games a player has hidden from their public profile shelf. */
  hiddenGames: Record<string, string[]>
  /** Public media URLs, keyed by user id — the same string auth-profile stores. */
  avatarUrls: Record<string, string>
  orders: Order[]
  plans: InstalmentPlan[]
  wallets: Record<string, Wallet>
  ledgers: Record<string, LedgerEntry[]>
  notifications: Record<string, Notification[]>
  roleRequests: RoleRequest[]
  reviews: Record<string, GameReview[]>
  promotions: Record<string, Promotion[]>

  // --- marketplace (requirement 1.6) ---------------------------------------
  marketItems: MarketItem[]
  marketOrders: MarketOrder[]
  marketTrades: Trade[]
  marketHoldings: Holding[]

  // --- reviews (requirement 1.7) -------------------------------------------
  userReviews: Record<string, Review[]>
  /** `(review_id, user_id) -> reaction`, the idempotency the real service's
   *  `ReactionModel` table provides — a repeat reaction swaps rather than stacks. */
  reviewReactions: Record<string, Record<string, ReviewSentiment>>
  /** How many times a review has been reported, hidden from every response —
   *  the real service tracks this to refuse an 11th report, not to publish a count. */
  reviewReportCounts: Record<string, number>

  // --- festivals (requirement 1.9) -----------------------------------------
  festivals: FestivalDetailView[]

  // --- community (requirement 1.8) -----------------------------------------
  posts: Post[]
  comments: Record<string, Comment[]>
  /** `(post_id, user_id) -> emoji` — the idempotency `PUT .../reactions` needs. */
  postReactions: Record<string, Record<string, string>>
  communityReports: Report[]

  // --- wallet funding (requirement 1.5) ------------------------------------
  /** Bank top-ups in flight, keyed by payment intent. A charge exists before
   *  any money moves, which is the whole point of the two-step flow. */
  charges: Record<string, MockCharge>
  giftCards: MockGiftCard[]
}

/** A bank top-up between "user pressed the button" and "the bank confirmed". */
export interface MockCharge {
  user_id: string
  amount: Money
  settled: boolean
}

/**
 * wallet-service's `GiftCardView`, field for field.
 *
 * It used to be `{amount, issued_at, status: USED}` — none of which the service returns.
 * `code` is kept here because something has to redeem against it, but it is only ever
 * *sent* in the response that mints the card, exactly as the service does: wallet stores
 * a hash, so a listed card carries `code_hint` and nothing more.
 */
export interface MockGiftCard {
  id: string
  code: string
  code_hint: string
  value: Money
  status: "ACTIVE" | "REDEEMED" | "REVOKED"
  issued_by: string
  batch_id: string
  note: string
  redeemed_by?: string
  redeemed_at?: string | null
  created_at: string
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
      { id: id("med"), kind: "TEASER", media_ref: seed.cover, position: 0 },
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

function gameIdByTitle(games: Game[], title: string): string {
  const game = games.find((candidate) => candidate.title === title)
  if (!game) throw new Error(`seed: no game titled "${title}"`)
  return game.id
}

function buildMarketItems(games: Game[]): MarketItem[] {
  return SEED_MARKET_ITEMS.map((seed) => ({
    id: id("item"),
    game_id: gameIdByTitle(games, seed.gameTitle),
    developer_id: DEVELOPER_ID,
    title: seed.title,
    description: seed.description,
    image_url: seed.imageUrl,
    buy_value: minor(seed.buyValue),
    sell_value: minor(seed.sellValue),
    created_at: iso(-60 * 24 * 10),
  }))
}

/** One holding of the first market item, so the player's holdings and the
 *  library-adjacent parts of the market page are not empty on first run. */
function buildMarketHoldings(items: MarketItem[]): Holding[] {
  if (items.length === 0) return []
  return [{ user_id: PLAYER_ID, item_id: items[0].id, quantity: 1 }]
}

/**
 * Festivals plus, for the ACTIVE seed's first game, an already-ACTIVE promotion
 * carrying that festival's id — exactly what `startFestival`/`proposePromotion`
 * produce together in normal use, so the seed does not need a second code path.
 * `discounted_price`/`discount_bps` on the returned game views are always `null`
 * here: `festivalGameView()` computes them live from `promotions[gameId]`, the
 * same read-model join the real service does from `game-events`.
 */
function buildFestivals(games: Game[]): {
  festivals: FestivalDetailView[]
  promotions: Record<string, Promotion[]>
} {
  const promotions: Record<string, Promotion[]> = {}
  const festivals = SEED_FESTIVALS.map((seed) => {
    const festivalId = id("fest")
    const active = seed.state === "ACTIVE"
    const gameViews: FestivalGameView[] = seed.gameTitles.map((title) => {
      const game = games.find((candidate) => candidate.title === title)
      if (!game) throw new Error(`seed: no game titled "${title}"`)
      return {
        game_id: game.id,
        title: game.title,
        developer_id: game.developer_id,
        added_by: ADMIN_ID,
        added_at: iso(-60 * 24 * 3),
        discounted_price: null,
        discount_bps: null,
      }
    })

    if (active && seed.discountBpsOnFirstGame && gameViews.length > 0) {
      const gameId = gameViews[0].game_id
      const price = games.find((g) => g.id === gameId)?.final_price
      promotions[gameId] = [
        {
          id: id("promo"),
          game_id: gameId,
          discount_bps: seed.discountBpsOnFirstGame,
          percent_off: seed.discountBpsOnFirstGame / 100,
          state: "ACTIVE",
          starts_at: iso(seed.startInDays * 24 * 60),
          ends_at: iso(seed.endInDays * 24 * 60),
          live: true,
          proposed_by: SUPPORT_ID,
          festival_id: festivalId,
          note: `Seeded for ${seed.name}`,
          decided_by: gameViews[0].developer_id,
          decision_note: "",
          created_at: iso(-60 * 24 * 4),
        },
      ]
      if (price) {
        const discounted = money(
          parse(price) - share(parse(price), seed.discountBpsOnFirstGame)
        )
        const game = games.find((g) => g.id === gameId)
        if (game) {
          game.discount_bps = seed.discountBpsOnFirstGame
          game.effective_price = discounted
        }
      }
    }

    return {
      id: festivalId,
      name: seed.name,
      description: seed.description,
      state: seed.state,
      starts_at: iso(seed.startInDays * 24 * 60),
      ends_at: iso(seed.endInDays * 24 * 60),
      game_count: gameViews.length,
      created_by: ADMIN_ID,
      created_at: iso(-60 * 24 * 5),
      started_at: active ? iso(seed.startInDays * 24 * 60) : null,
      ended_at: null,
      games: gameViews,
      promotions: [],
    }
  })
  return { festivals, promotions }
}

function buildPosts(games: Game[]): {
  posts: Post[]
  comments: Record<string, Comment[]>
} {
  const posts: Post[] = []
  const comments: Record<string, Comment[]> = {}
  for (const seed of SEED_POSTS) {
    const postId = id("post")
    const reactions = seed.reactions ?? {}
    posts.push({
      id: postId,
      game_id: gameIdByTitle(games, seed.gameTitle),
      author_id: seed.authorId,
      body: seed.body,
      spoiler: seed.spoiler ?? false,
      tags: seed.tags,
      attachments: [],
      reactions,
      comment_count: seed.comments?.length ?? 0,
      view_count: Math.floor(Math.random() * 200) + 20,
      feedback_score: Object.values(reactions).reduce((a, b) => a + b, 0),
      status: "ACTIVE",
      created_at: iso(-60 * (Math.floor(Math.random() * 500) + 30)),
      edited_at: null,
    })
    comments[postId] = (seed.comments ?? []).map((comment) => ({
      id: id("cmt"),
      post_id: postId,
      author_id: comment.authorId,
      body: comment.body,
      status: "ACTIVE",
      created_at: iso(-60 * 20),
      edited_at: null,
    }))
  }
  return { posts, comments }
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

  const marketItems = buildMarketItems(games)
  const { festivals, promotions: festivalPromotions } = buildFestivals(games)
  const { posts, comments } = buildPosts(games)

  // A couple of owned games so the player's public profile is not an empty shelf
  // on first open — same reason market holdings start with one item.
  const published = games.filter((game) => game.state === "PUBLISHED")
  const seedOwnerships: Ownership[] = published.slice(0, 2).map((game) => ({
    id: id("own"),
    game_id: game.id,
    owner_id: PLAYER_ID,
    order_id: id("ord"),
    status: "ACTIVE",
    granted_at: iso(-60 * 24 * 5),
    revoked_at: null,
    gifted_by: "",
  }))

  return {
    users,
    sessionUserId: null,
    games,
    ownerships: seedOwnerships,
    hiddenGames: {},
    avatarUrls: {},
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
    promotions: festivalPromotions,

    marketItems,
    marketOrders: [],
    marketTrades: [],
    marketHoldings: buildMarketHoldings(marketItems),

    userReviews: {},
    reviewReactions: {},
    reviewReportCounts: {},

    festivals,

    posts,
    comments,
    postReactions: {},
    communityReports: [],
    charges: {},
    // Two live cards so Support has something to show and a player has
    // something to redeem without an issuing step first.
    giftCards: [
      {
        id: "gc-seed-1",
        code: "ARCA-DIA1-GIFT",
        code_hint: "GIFT",
        value: minor(50_000),
        status: "ACTIVE",
        issued_by: SUPPORT_ID,
        batch_id: "batch-seed-1",
        note: "Launch giveaway",
        created_at: iso(-3 * 24 * 60),
        redeemed_at: null,
      },
      {
        id: "gc-seed-2",
        code: "PLAY-MORE-2026",
        code_hint: "2026",
        value: minor(120_000),
        status: "ACTIVE",
        issued_by: SUPPORT_ID,
        batch_id: "batch-seed-1",
        note: "Launch giveaway",
        created_at: iso(-24 * 60),
        redeemed_at: null,
      },
    ],
  }
}

// --- persistence -----------------------------------------------------------
//
// Survives a reload, because a mock that resets on every refresh makes the app
// impossible to demonstrate: you buy a game, reload to check the library, and the
// purchase is gone. The version means changing the seed starts fresh rather than
// leaving a half-migrated shape in somebody's browser.

// Bumped for marketplace/reviews/festivals/community: an old snapshot has none
// of those keys, and the alternative to a version bump is every new function
// below defending against a store that predates it.
const SNAPSHOT_VERSION = 3

interface Snapshot {
  version: number
  sequence: number
  store: Store
}

function load(): Store {
  const saved = ls.get<Snapshot | null>(STORAGE_KEYS.mockDb, null)
  if (saved && saved.version === SNAPSHOT_VERSION) {
    sequence = saved.sequence
    if (!saved.store.avatarUrls) saved.store.avatarUrls = {}
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
  // Requirement 1.1 used to hold new accounts for Support. Ordinary sign-ups
  // are ACTIVE now; PENDING is leftover, and login still refuses it.
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
    state: "ACTIVE",
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

/**
 * The auth-profile shelf: what `GET /v1/profile/{id}` returns live.
 *
 * Identity fields are included so `useMeQuery` can hydrate the session in mock
 * mode — live JWTs carry `role` instead.
 */
export function publicProfile(userId: string): PublicProfile {
  const user = db.users.find((candidate) => candidate.user_id === userId)
  if (!user) throw new MockRuleError(404, "NOT_FOUND", "No such account")

  const hidden = new Set(db.hiddenGames[userId] ?? [])
  const ownedGames = db.ownerships
    .filter((entry) => entry.owner_id === userId && entry.status === "ACTIVE")
    .map((entry) => ({
      game_id: entry.game_id,
      hidden: hidden.has(entry.game_id),
    }))
    // The owner sees everything, flagged; a visitor sees only what the owner chose to
    // show. Filtering unconditionally is what made hiding permanent — the game left the
    // one list from which it could have been unhidden.
    .filter((entry) => !entry.hidden || currentUser().user_id === userId)

  const ownedItems = db.marketHoldings
    .filter((holding) => holding.user_id === userId && holding.quantity > 0)
    .map((holding) => {
      const item = db.marketItems.find(
        (candidate) => candidate.id === holding.item_id
      )
      return {
        item_id: holding.item_id,
        game_id: item?.game_id ?? "",
      }
    })

  const topPosts = [...db.posts]
    .filter((post) => post.author_id === userId && post.status === "ACTIVE")
    .sort((a, b) => b.feedback_score - a.feedback_score)
    .slice(0, 5)
    .map((post, index) => ({
      post_id: post.id,
      feedback_score: post.feedback_score,
      rank: index + 1,
    }))

  return {
    user_id: user.user_id,
    display_name: user.display_name,
    avatar_url: db.avatarUrls[userId] ?? "",
    online: db.sessionUserId === userId,
    owned_games: ownedGames,
    owned_items: ownedItems,
    top_posts: topPosts,
    email: user.email,
    role: user.role,
    state: user.state,
  }
}

export function hideOwnedGame(gameId: string): void {
  const user = currentUser()
  if (!ownedGameIds(user.user_id).has(gameId)) {
    throw new MockRuleError(
      404,
      "NOT_FOUND",
      "That game is not in your library"
    )
  }
  const list = new Set(db.hiddenGames[user.user_id] ?? [])
  list.add(gameId)
  db.hiddenGames[user.user_id] = [...list]
  save()
}

export function setAvatar(avatarUrl: string): void {
  const user = currentUser()
  db.avatarUrls[user.user_id] = avatarUrl.trim()
  save()
}

export function unhideOwnedGame(gameId: string): void {
  const user = currentUser()
  const list = new Set(db.hiddenGames[user.user_id] ?? [])
  list.delete(gameId)
  db.hiddenGames[user.user_id] = [...list]
  save()
}

export function topPostsByAuthor(authorId: string) {
  return [...db.posts]
    .filter((post) => post.author_id === authorId && post.status === "ACTIVE")
    .sort((a, b) => b.feedback_score - a.feedback_score)
    .slice(0, 5)
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
): LedgerEntry {
  const wallet = walletOf(userId)
  const ledger = db.ledgers[userId] ?? []
  const entry: LedgerEntry = {
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
  }
  ledger.unshift(entry)
  db.ledgers[userId] = ledger
  return entry
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
): LedgerEntry {
  const wallet = walletOf(userId)
  wallet.balance = money(parse(wallet.balance) + parse(amount))
  wallet.available = money(parse(wallet.balance) - parse(wallet.held))
  wallet.version += 1
  wallet.updated_at = iso()
  return recordEntry(userId, "CREDIT", amount, reason, referenceId, description)
}

/** The wallet service's own floor, so the mock refuses what the platform refuses. */
const MINIMUM_CHARGE_MINOR = 1_000n

/**
 * Starts a bank top-up, exactly as the wallet service does: it records an intent
 * and credits nothing.
 *
 * The old mock credited immediately and returned the new balance, which is not
 * what any deployment does — the wallet is credited when the bank confirms. A
 * mock that skips the bank is how a demo can show a working top-up while the
 * real flow is broken, which is precisely what had happened.
 */
export function initiateCharge(amount: Money): ChargeResult {
  const user = currentUser()
  if (parse(amount) < MINIMUM_CHARGE_MINOR) {
    throw new MockRuleError(
      400,
      "AMOUNT_TOO_SMALL",
      `The minimum top-up is ${MINIMUM_CHARGE_MINOR / 100n}`
    )
  }
  const intentId = id("pi")
  db.charges[intentId] = { user_id: user.user_id, amount, settled: false }
  save()
  return {
    payment_intent_id: intentId,
    // Stands in for the payment service's /mock-bank/pay page. Same contract:
    // somewhere to send the browser that comes back when the user is done.
    redirect_url: `/mock-bank/${intentId}`,
    amount,
    idempotent_replay: false,
  }
}

/**
 * What the bank's confirmation would trigger. In the real platform this is a
 * Kafka event the user never sees; here the mock bank page calls it.
 */
export function settleCharge(intentId: string): Wallet {
  const charge = db.charges[intentId]
  if (!charge) {
    throw new MockRuleError(404, "NOT_FOUND", "No such payment")
  }
  if (charge.settled) {
    // Idempotent, like the real confirmation path: a redelivered event, or a
    // reloaded page, must not credit twice.
    return walletOf(charge.user_id)
  }
  charge.settled = true
  credit(charge.user_id, charge.amount, "TOP_UP", intentId, "Wallet top-up")
  save()
  return walletOf(charge.user_id)
}

export function chargeById(intentId: string): MockCharge {
  const charge = db.charges[intentId]
  if (!charge) {
    throw new MockRuleError(404, "NOT_FOUND", "No such payment")
  }
  return charge
}

export function redeemGiftCard(code: string): RedeemGiftCardResult {
  const user = currentUser()
  const card = db.giftCards.find(
    (entry) => entry.code.toUpperCase() === code.trim().toUpperCase()
  )
  if (!card) {
    throw new MockRuleError(404, "GIFT_CARD_NOT_FOUND", "No such gift card")
  }
  if (card.status === "REDEEMED") {
    throw new MockRuleError(
      409,
      "GIFT_CARD_ALREADY_USED",
      "That card has already been redeemed"
    )
  }
  if (card.status === "REVOKED") {
    throw new MockRuleError(409, "GIFT_CARD_REVOKED", "That card was revoked")
  }
  card.status = "REDEEMED"
  card.redeemed_by = user.user_id
  card.redeemed_at = new Date().toISOString()
  const entry = credit(
    user.user_id,
    card.value,
    "GIFT_CARD",
    card.id,
    "Gift card redeemed"
  )
  save()
  return {
    credited: card.value,
    wallet: walletOf(user.user_id),
    entry,
    idempotent_replay: false,
  }
}

/**
 * Support or Admin mints a batch. The codes come back here and never again — the same
 * bargain the service makes, because it keeps only a hash of each one.
 */
export function issueGiftCards(
  value: Money,
  quantity: number,
  note: string
): {
  batch_id: string
  gift_cards: MockGiftCard[]
  idempotent_replay: boolean
} {
  requireRole("SUPPORT", "ADMIN")
  if (parse(value) <= 0n) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "The amount must be greater than zero"
    )
  }
  const count = Math.min(Math.max(Math.trunc(quantity) || 1, 1), 100)
  const batchId = id("batch")
  const issued: MockGiftCard[] = []

  for (let index = 0; index < count; index += 1) {
    const code = giftCardCode()
    const card: MockGiftCard = {
      id: id("gc"),
      code,
      code_hint: code.slice(-4),
      value,
      status: "ACTIVE",
      issued_by: currentUser().user_id,
      batch_id: batchId,
      note,
      created_at: new Date().toISOString(),
      redeemed_at: null,
    }
    db.giftCards.unshift(card)
    issued.push(card)
  }
  save()
  return { batch_id: batchId, gift_cards: issued, idempotent_replay: false }
}

/**
 * Support's list, **without** the codes.
 *
 * The service cannot return them — it holds a hash — so a mock that did would make the
 * "copy these now, they are shown once" warning look like a lie the app tells.
 */
export function listGiftCards(): MockGiftCard[] {
  requireRole("SUPPORT", "ADMIN")
  return db.giftCards.map((card) => ({ ...card, code: "" }))
}

function giftCardCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const block = () =>
    Array.from(
      { length: 4 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("")
  return `${block()}-${block()}-${block()}`
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
      state === "COMPLETED" && type !== "GIFT"
        ? iso(REFUND_WINDOW_HOURS * 60)
        : null,
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
  if (order.gift) {
    throw new MockRuleError(
      409,
      "GIFT_NOT_REFUNDABLE",
      "A gift cannot be refunded"
    )
  }
  if (order.state !== "COMPLETED" && order.state !== "PAYING") {
    throw new MockRuleError(
      409,
      "ORDER_NOT_COMPLETED",
      "This order cannot be refunded"
    )
  }
  if (
    !order.refundable_until ||
    new Date(order.refundable_until).getTime() < Date.now()
  ) {
    throw new MockRuleError(
      409,
      "REFUND_WINDOW_CLOSED",
      "The refund window has closed"
    )
  }

  const plan = db.plans.find((candidate) => candidate.order_id === order.id)
  // An instalment refunds what was collected, not the full price — otherwise
  // a buyer one payment in would be handed money the platform never took.
  const amount =
    order.state === "PAYING" && plan ? plan.paid : order.total_charged
  credit(
    user.user_id,
    amount,
    "REFUND",
    order.id,
    `Refund for ${order.game_title}`
  )
  order.state = "REFUNDED"
  order.refunded_at = iso()

  if (plan && plan.state === "PAYING") {
    plan.state = "CANCELLED"
    plan.next_due_at = null
  }

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
  // Same twelve-hour window as a full purchase, measured from the first payment.
  order.refundable_until = iso(REFUND_WINDOW_HOURS * 60)
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
    media: [],
    created_at: iso(),
    updated_at: iso(),
    published_at: null,
  }
  db.games.unshift(game)
  save()
  return game
}

export function uploadMedia(file: File, kind: string, referenceId: string) {
  const user = currentUser()
  const mediaId = id("med")
  const url = file.type.startsWith("image/")
    ? URL.createObjectURL(file)
    : `/media/${mediaId}`
  return {
    id: mediaId,
    kind,
    url,
    content_type: file.type,
    size_bytes: file.size,
    filename: file.name,
    owner_id: user.user_id,
    visibility: "PUBLIC",
    reference_id: referenceId,
  }
}

export function addGameMedia(
  gameId: string,
  kind: "TEASER" | "IMAGE",
  mediaRef: string
): Game {
  requireRole("DEVELOPER")
  const game = ownGame(gameId)
  if (kind === "TEASER" && game.media.some((item) => item.kind === "TEASER")) {
    throw new MockRuleError(
      409,
      "TEASER_EXISTS",
      "this game already has a teaser; remove it first"
    )
  }
  game.media.push({
    id: id("med"),
    kind,
    media_ref: mediaRef,
    position: game.media.length,
  })
  if (kind === "TEASER") game.teaser_ref = mediaRef
  game.updated_at = iso()
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
  note: string,
  festivalId = ""
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
  if (
    festivalId &&
    !db.festivals.some((festival) => festival.id === festivalId)
  ) {
    throw new MockRuleError(404, "NOT_FOUND", "No such festival")
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
    festival_id: festivalId,
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

// --- marketplace (requirement 1.6) ------------------------------------------

function holdingOf(userId: string, itemId: string): Holding | undefined {
  return db.marketHoldings.find(
    (holding) => holding.user_id === userId && holding.item_id === itemId
  )
}

function adjustHolding(userId: string, itemId: string, delta: number): void {
  const existing = holdingOf(userId, itemId)
  if (existing) existing.quantity += delta
  else
    db.marketHoldings.push({
      user_id: userId,
      item_id: itemId,
      quantity: delta,
    })
}

export function marketItemsOf(filters: { game_id?: string }): MarketItem[] {
  return db.marketItems.filter(
    (item) => !filters.game_id || item.game_id === filters.game_id
  )
}

export function marketItemById(itemId: string): MarketItem {
  const item = db.marketItems.find((candidate) => candidate.id === itemId)
  if (!item) throw new MockRuleError(404, "NOT_FOUND", "No such item")
  return item
}

export function createMarketItem(input: {
  game_id: string
  title: string
  description: string
  image_url: string
  buy_value: string
  sell_value: string
}): MarketItem {
  const user = requireRole("DEVELOPER", "ADMIN")
  const title = input.title.trim()
  if (!title)
    throw new MockRuleError(400, "TITLE_REQUIRED", "A title is required")
  if (title.length > 120)
    throw new MockRuleError(400, "TITLE_TOO_LONG", "At most 120 characters")
  let buyValue: bigint
  let sellValue: bigint
  try {
    buyValue = BigInt(input.buy_value || "0")
    sellValue = BigInt(input.sell_value || "0")
  } catch {
    throw new MockRuleError(
      400,
      "INVALID_AMOUNT",
      "Values must be whole numbers"
    )
  }
  if (buyValue < 0n || sellValue < 0n) {
    throw new MockRuleError(400, "INVALID_VALUE", "A value cannot be negative")
  }
  const item: MarketItem = {
    id: id("item"),
    game_id: input.game_id,
    developer_id: user.user_id,
    title,
    description: input.description.trim(),
    image_url: input.image_url.trim(),
    buy_value: money(buyValue),
    sell_value: money(sellValue),
    created_at: iso(),
  }
  db.marketItems.unshift(item)
  save()
  return item
}

export function distributeMarketItem(
  itemId: string,
  count: number
): { granted: number } {
  requireRole("SUPPORT", "ADMIN")
  const item = marketItemById(itemId)
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new MockRuleError(400, "INVALID_COUNT", "Between 1 and 500")
  }
  const recipients = db.users.filter(
    (candidate) => candidate.state === "ACTIVE"
  )
  if (recipients.length === 0) {
    throw new MockRuleError(
      422,
      "NO_RECIPIENTS",
      "No known users to distribute to yet"
    )
  }
  const granted = Math.min(count, recipients.length)
  const shuffled = [...recipients].sort(() => Math.random() - 0.5)
  for (const recipient of shuffled.slice(0, granted)) {
    adjustHolding(recipient.user_id, item.id, 1)
  }
  save()
  return { granted }
}

export function placeMarketOrder(input: {
  item_id: string
  side: OrderSide
  price: string
}): MarketOrder {
  const user = currentUser()
  const item = marketItemById(input.item_id)
  if (input.side !== "BUY" && input.side !== "SELL") {
    throw new MockRuleError(400, "INVALID_SIDE", "side must be BUY or SELL")
  }
  let price: bigint
  try {
    price = BigInt(input.price || "0")
  } catch {
    throw new MockRuleError(
      400,
      "INVALID_AMOUNT",
      "Price must be a whole number"
    )
  }
  if (price <= 0n) {
    throw new MockRuleError(400, "INVALID_PRICE", "A price must be positive")
  }
  if (input.side === "SELL") {
    const held = holdingOf(user.user_id, item.id)
    if (!held || held.quantity <= 0) {
      throw new MockRuleError(422, "ITEM_NOT_HELD", "You do not hold this item")
    }
  }
  const order: MarketOrder = {
    id: id("mord"),
    item_id: item.id,
    user_id: user.user_id,
    side: input.side,
    price: money(price),
    status: "OPEN",
    created_at: iso(),
  }
  db.marketOrders.unshift(order)
  save()
  return order
}

export function cancelMarketOrder(orderId: string): MarketOrder {
  const user = currentUser()
  const order = db.marketOrders.find((candidate) => candidate.id === orderId)
  if (!order) throw new MockRuleError(404, "NOT_FOUND", "No such order")
  if (order.user_id !== user.user_id) {
    throw new MockRuleError(
      403,
      "NOT_ORDER_OWNER",
      "That order belongs to someone else"
    )
  }
  if (order.status === "FILLED") {
    throw new MockRuleError(
      409,
      "ORDER_ALREADY_FILLED",
      "This order already matched"
    )
  }
  if (order.status === "CANCELLED") {
    throw new MockRuleError(
      409,
      "ORDER_ALREADY_CANCELLED",
      "This order is already cancelled"
    )
  }
  order.status = "CANCELLED"
  save()
  return order
}

export function myMarketOrders(): MarketOrder[] {
  const user = currentUser()
  return db.marketOrders.filter((order) => order.user_id === user.user_id)
}

export function myMarketTrades(): Trade[] {
  const user = currentUser()
  return db.marketTrades.filter(
    (trade) =>
      trade.buyer_id === user.user_id || trade.seller_id === user.user_id
  )
}

export function holdingsOf(userId: string): Holding[] {
  const user = currentUser()
  if (
    user.user_id !== userId &&
    user.role !== "SUPPORT" &&
    user.role !== "ADMIN"
  ) {
    throw new MockRuleError(403, "PERMISSION_DENIED", "Not your holdings")
  }
  return db.marketHoldings.filter(
    (holding) => holding.user_id === userId && holding.quantity > 0
  )
}

export function marketBook(itemId: string): BookView {
  marketItemById(itemId) // 404s if the item does not exist
  const open = db.marketOrders.filter(
    (order) => order.item_id === itemId && order.status === "OPEN"
  )

  function aggregate(side: OrderSide): BookDepth[] {
    const byPrice = new Map<string, BookDepth>()
    for (const order of open) {
      if (order.side !== side) continue
      const key = order.price.amount_minor
      const existing = byPrice.get(key)
      if (existing) existing.orders += 1
      else byPrice.set(key, { price: order.price, orders: 1 })
    }
    return [...byPrice.values()].sort((a, b) =>
      side === "BUY"
        ? Number(parse(b.price) - parse(a.price))
        : Number(parse(a.price) - parse(b.price))
    )
  }

  const buys = aggregate("BUY")
  const sells = aggregate("SELL")
  const best: NonNullable<BookView["best"]> = {}
  if (buys[0]) best.bid = buys[0].price
  if (sells[0]) best.ask = sells[0].price

  return {
    item_id: itemId,
    buys,
    sells,
    ...(best.bid || best.ask ? { best } : {}),
  }
}

/**
 * The five-minute matching pass, run on demand.
 *
 * Cheapest sell first, oldest wins a tie, settles at the seller's price, never
 * a self-trade, and a seller who no longer holds the item is skipped — the same
 * rules the real matching engine enforces (see marketplace-service's README),
 * reproduced here rather than waved at, because a mock that skips them would
 * teach a screen to expect a trade the real service would refuse.
 */
export function runMarketMatching(): { status: "COMPLETED" } {
  requireRole("SUPPORT", "ADMIN")
  const itemIds = new Set(
    db.marketOrders
      .filter((order) => order.status === "OPEN")
      .map((order) => order.item_id)
  )

  for (const itemId of itemIds) {
    const buys = db.marketOrders
      .filter(
        (order) =>
          order.item_id === itemId &&
          order.status === "OPEN" &&
          order.side === "BUY"
      )
      .sort(
        (a, b) =>
          Number(parse(b.price) - parse(a.price)) ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )

    for (const buy of buys) {
      if (buy.status !== "OPEN") continue
      const sell = db.marketOrders
        .filter(
          (order) =>
            order.item_id === itemId &&
            order.status === "OPEN" &&
            order.side === "SELL"
        )
        .sort(
          (a, b) =>
            Number(parse(a.price) - parse(b.price)) ||
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        .find(
          (candidate) =>
            candidate.user_id !== buy.user_id &&
            parse(candidate.price) <= parse(buy.price) &&
            (holdingOf(candidate.user_id, itemId)?.quantity ?? 0) > 0
        )
      if (!sell) continue

      const settlePrice = sell.price
      const buyerWallet = db.wallets[buy.user_id]
      const sellerWallet = db.wallets[sell.user_id]
      if (!buyerWallet || !sellerWallet) continue
      if (parse(buyerWallet.available) < parse(settlePrice)) continue

      debit(buy.user_id, settlePrice, "MARKET_TRADE", itemId, "Item purchase")
      credit(sell.user_id, settlePrice, "MARKET_TRADE", itemId, "Item sale")
      adjustHolding(sell.user_id, itemId, -1)
      adjustHolding(buy.user_id, itemId, 1)

      const trade: Trade = {
        id: id("trade"),
        item_id: itemId,
        buyer_id: buy.user_id,
        seller_id: sell.user_id,
        price: settlePrice,
        matched_at: iso(),
      }
      db.marketTrades.unshift(trade)
      buy.status = "FILLED"
      buy.trade_id = trade.id
      sell.status = "FILLED"
      sell.trade_id = trade.id

      const item = db.marketItems.find((candidate) => candidate.id === itemId)
      const title = item?.title ?? "an item"
      notify(buy.user_id, "TRADE_MATCHED", `You bought ${title}`, "", {
        type: "TRADE",
        id: trade.id,
      })
      notify(sell.user_id, "TRADE_MATCHED", `You sold ${title}`, "", {
        type: "TRADE",
        id: trade.id,
      })
    }
  }

  save()
  return { status: "COMPLETED" }
}

// --- reviews (requirement 1.7) ----------------------------------------------

function reviewsForGame(gameId: string): Review[] {
  return db.userReviews[gameId] ?? []
}

function findUserReview(reviewId: string): { gameId: string; review: Review } {
  for (const [gameId, reviews] of Object.entries(db.userReviews)) {
    const review = reviews.find((candidate) => candidate.id === reviewId)
    if (review) return { gameId, review }
  }
  throw new MockRuleError(404, "NOT_FOUND", "No such review")
}

function reviewWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function assertReviewWordLimit(text: string): void {
  if (!text.trim())
    throw new MockRuleError(400, "VALIDATION_FAILED", "A review needs text")
  if (reviewWordCount(text) > MAX_REVIEW_WORDS) {
    throw new MockRuleError(
      400,
      "WORD_LIMIT_EXCEEDED",
      `A review is at most ${MAX_REVIEW_WORDS} words`
    )
  }
}

/** Requirement 1.7: buyers, including a gift's recipient and someone who
 *  refunded — anyone who was ever granted ownership, not just current owners. */
export function everOwnedGame(userId: string, gameId: string): boolean {
  return db.ownerships.some(
    (entry) => entry.owner_id === userId && entry.game_id === gameId
  )
}

export function createUserReview(input: {
  game_id: string
  text: string
  sentiment: ReviewSentiment
}): Review {
  const user = currentUser()
  if (!everOwnedGame(user.user_id, input.game_id)) {
    throw new MockRuleError(403, "NOT_OWNER", "Only buyers can review a game")
  }
  assertReviewWordLimit(input.text)
  const review: Review = {
    id: id("rvw"),
    author_id: user.user_id,
    game_id: input.game_id,
    text: input.text.trim(),
    sentiment: input.sentiment,
    status: "ACTIVE",
    like_count: 0,
    dislike_count: 0,
    created_at: iso(),
    edited_at: null,
  }
  db.userReviews[input.game_id] = [...reviewsForGame(input.game_id), review]
  save()
  return review
}

export function editUserReview(
  reviewId: string,
  text: string,
  sentiment?: ReviewSentiment
): Review {
  const user = currentUser()
  const { review } = findUserReview(reviewId)
  if (review.author_id !== user.user_id) {
    throw new MockRuleError(403, "NOT_AUTHOR", "That review is not yours")
  }
  if (review.status === "DELETED") {
    throw new MockRuleError(
      409,
      "REVIEW_ALREADY_DELETED",
      "Cannot edit a deleted review"
    )
  }
  assertReviewWordLimit(text)
  review.text = text.trim()
  if (sentiment) review.sentiment = sentiment
  review.status = "EDITED"
  review.edited_at = iso()
  save()
  return review
}

export function deleteUserReview(reviewId: string): void {
  const user = currentUser()
  const { review } = findUserReview(reviewId)
  if (review.author_id !== user.user_id) {
    throw new MockRuleError(403, "NOT_AUTHOR", "That review is not yours")
  }
  if (review.status === "DELETED") {
    throw new MockRuleError(
      409,
      "REVIEW_ALREADY_DELETED",
      "Review already deleted"
    )
  }
  review.status = "DELETED"
  save()
}

/** Idempotent per `(review_id, user_id)`, the way the real `ReactionModel`
 *  table is — a repeated reaction swaps or no-ops, and never double-counts. */
export function reactToUserReview(
  reviewId: string,
  reactionType: ReviewSentiment
): void {
  const user = currentUser()
  const { review } = findUserReview(reviewId)
  if (review.author_id === user.user_id) {
    throw new MockRuleError(
      400,
      "OWN_REVIEW_NOT_ALLOWED",
      "You cannot react to your own review"
    )
  }
  const perReview = db.reviewReactions[reviewId] ?? {}
  const previous = perReview[user.user_id]
  if (previous === reactionType) {
    save()
    return
  }
  if (previous === "LIKE")
    review.like_count = Math.max(0, review.like_count - 1)
  if (previous === "DISLIKE")
    review.dislike_count = Math.max(0, review.dislike_count - 1)
  if (reactionType === "LIKE") review.like_count += 1
  else review.dislike_count += 1
  perReview[user.user_id] = reactionType
  db.reviewReactions[reviewId] = perReview
  save()
}

export function reportUserReview(reviewId: string, reason: string): void {
  const user = currentUser()
  const { review } = findUserReview(reviewId)
  if (review.author_id === user.user_id) {
    throw new MockRuleError(
      400,
      "OWN_REVIEW_NOT_ALLOWED",
      "You cannot report your own review"
    )
  }
  if (review.status === "DELETED") {
    throw new MockRuleError(
      409,
      "REVIEW_ALREADY_DELETED",
      "Cannot report a deleted review"
    )
  }
  if (reason.trim().length < 3) {
    throw new MockRuleError(400, "VALIDATION_FAILED", "Say a little more")
  }
  const count = (db.reviewReportCounts[reviewId] ?? 0) + 1
  if (count > 10) {
    throw new MockRuleError(
      422,
      "TOO_MANY_REPORTS",
      "Too many reports on this review"
    )
  }
  db.reviewReportCounts[reviewId] = count
  save()
}

export function gameReviews(
  gameId: string,
  filters: {
    limit?: number
    offset?: number
    sort_by?: ReviewSortBy
    sort_order?: SortOrder
  }
): { reviews: Review[]; total: number; page: number; page_size: number } {
  const limit = filters.limit ?? 20
  const offset = filters.offset ?? 0
  const sortBy = filters.sort_by ?? "created_at"
  const sortOrder = filters.sort_order ?? "desc"

  const list = reviewsForGame(gameId).filter(
    (review) => review.status !== "DELETED"
  )
  const sorted = [...list].sort((a, b) => {
    const av =
      sortBy === "created_at" ? new Date(a.created_at).getTime() : a[sortBy]
    const bv =
      sortBy === "created_at" ? new Date(b.created_at).getTime() : b[sortBy]
    return sortOrder === "asc" ? av - bv : bv - av
  })
  const page = sorted.slice(offset, offset + limit)
  return {
    reviews: page,
    // The real service's own bug, reproduced rather than papered over: `total`
    // is the size of this page, not of every matching row — see the type's doc.
    total: page.length,
    page: Math.floor(offset / limit) + 1,
    page_size: limit,
  }
}

export function averageRating(gameId: string): {
  game_id: string
  average_rating: number | null
  total_reviews: number
  likes: number
  dislikes: number
} {
  const list = reviewsForGame(gameId).filter(
    (review) => review.status !== "DELETED"
  )
  const likes = list.filter((review) => review.sentiment === "LIKE").length
  const dislikes = list.length - likes
  return {
    game_id: gameId,
    average_rating: list.length > 0 ? likes / list.length : null,
    total_reviews: list.length,
    likes,
    dislikes,
  }
}

// --- festivals (requirement 1.9) --------------------------------------------

function festivalById(festivalId: string): FestivalDetailView {
  const festival = db.festivals.find((candidate) => candidate.id === festivalId)
  if (!festival) throw new MockRuleError(404, "NOT_FOUND", "No such festival")
  return festival
}

/** Recomputed from the live ACTIVE promotion tied to this festival, never
 *  stored twice — the same read-model join catalog_sync_service.py performs
 *  from `game-events` in the real service. */
function festivalGameView(
  festival: FestivalDetailView,
  game: FestivalGameView
): FestivalGameView {
  const active = promotionsOf(game.game_id).find(
    (promotion) =>
      promotion.festival_id === festival.id && promotion.state === "ACTIVE"
  )
  if (!active) return { ...game, discounted_price: null, discount_bps: null }
  const listPrice = db.games.find(
    (candidate) => candidate.id === game.game_id
  )?.final_price
  return {
    ...game,
    discounted_price: listPrice
      ? money(parse(listPrice) - share(parse(listPrice), active.discount_bps))
      : null,
    discount_bps: active.discount_bps,
  }
}

function festivalPromotionSnapshots(
  festival: FestivalDetailView
): PromotionSnapshotView[] {
  return festival.games.flatMap((game) =>
    promotionsOf(game.game_id)
      .filter((promotion) => promotion.festival_id === festival.id)
      .map((promotion) => {
        const listPrice =
          db.games.find((candidate) => candidate.id === game.game_id)
            ?.final_price ?? null
        return {
          promotion_id: promotion.id,
          game_id: promotion.game_id,
          state: promotion.state,
          discount_bps: promotion.discount_bps,
          starts_at: promotion.starts_at,
          ends_at: promotion.ends_at,
          list_price: listPrice,
          effective_price: listPrice
            ? money(
                parse(listPrice) -
                  share(parse(listPrice), promotion.discount_bps)
              )
            : null,
          updated_at: promotion.created_at ?? iso(),
        }
      })
  )
}

function toFestivalView(festival: FestivalDetailView): FestivalView {
  return {
    id: festival.id,
    name: festival.name,
    description: festival.description,
    state: festival.state,
    starts_at: festival.starts_at,
    ends_at: festival.ends_at,
    game_count: festival.game_count,
    created_by: festival.created_by,
    created_at: festival.created_at,
    started_at: festival.started_at,
    ended_at: festival.ended_at,
  }
}

function toFestivalDetail(festival: FestivalDetailView): FestivalDetailView {
  return {
    ...festival,
    games: festival.games.map((game) => festivalGameView(festival, game)),
    promotions: festivalPromotionSnapshots(festival),
  }
}

export function festivalsList(filters: { limit?: number; offset?: number }): {
  items: FestivalView[]
  total: number
  limit: number
  offset: number
} {
  const limit = filters.limit ?? 20
  const offset = filters.offset ?? 0
  const views = db.festivals.map(toFestivalView)
  return {
    items: views.slice(offset, offset + limit),
    total: views.length,
    limit,
    offset,
  }
}

export function festivalDetail(festivalId: string): FestivalDetailView {
  return toFestivalDetail(festivalById(festivalId))
}

export function createFestival(input: {
  name: string
  description?: string
  starts_at: string
  ends_at: string
}): FestivalDetailView {
  const user = requireRole("ADMIN")
  const name = input.name.trim()
  if (!name || name.length > 200) {
    throw new MockRuleError(
      400,
      "FESTIVAL_NAME_REQUIRED",
      "A festival needs a name, at most 200 characters"
    )
  }
  const startsAt = new Date(input.starts_at)
  const endsAt = new Date(input.ends_at)
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt.getTime() <= startsAt.getTime() ||
    endsAt.getTime() < Date.now()
  ) {
    throw new MockRuleError(
      400,
      "FESTIVAL_WINDOW_INVALID",
      "The window must end after it starts, and after now"
    )
  }
  const festival: FestivalDetailView = {
    id: id("fest"),
    name,
    description: (input.description ?? "").trim(),
    state: "DRAFT",
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    game_count: 0,
    created_by: user.user_id,
    created_at: iso(),
    started_at: null,
    ended_at: null,
    games: [],
    promotions: [],
  }
  db.festivals.unshift(festival)
  save()
  return toFestivalDetail(festival)
}

function assertFestivalEditable(festival: FestivalDetailView): void {
  if (festival.state !== "DRAFT" && festival.state !== "ACTIVE") {
    throw new MockRuleError(
      409,
      "FESTIVAL_WRONG_STATE",
      `A festival in ${festival.state} cannot be edited`
    )
  }
}

export function rescheduleFestival(
  festivalId: string,
  startsAt: string,
  endsAt: string
): FestivalDetailView {
  requireRole("ADMIN")
  const festival = festivalById(festivalId)
  if (festival.state !== "DRAFT") {
    throw new MockRuleError(
      409,
      "FESTIVAL_WRONG_STATE",
      "Only a draft festival can be rescheduled"
    )
  }
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new MockRuleError(
      400,
      "FESTIVAL_WINDOW_INVALID",
      "End must be after start"
    )
  }
  festival.starts_at = startsAt
  festival.ends_at = endsAt
  save()
  return toFestivalDetail(festival)
}

export function addFestivalGame(
  festivalId: string,
  gameId: string
): FestivalDetailView {
  const user = requireRole("ADMIN")
  const festival = festivalById(festivalId)
  assertFestivalEditable(festival)
  const game = db.games.find((candidate) => candidate.id === gameId)
  if (!game) throw new MockRuleError(404, "GAME_UNKNOWN", "No such game")
  if (game.state !== "PUBLISHED" && game.state !== "PREORDER") {
    throw new MockRuleError(
      422,
      "GAME_NOT_PUBLISHED",
      "Only a published game can join a festival"
    )
  }
  if (festival.games.some((entry) => entry.game_id === gameId)) {
    throw new MockRuleError(
      409,
      "GAME_ALREADY_IN_FESTIVAL",
      "That game is already in this festival"
    )
  }
  festival.games.push({
    game_id: game.id,
    title: game.title,
    developer_id: game.developer_id,
    added_by: user.user_id,
    added_at: iso(),
    discounted_price: null,
    discount_bps: null,
  })
  festival.game_count = festival.games.length
  save()
  return toFestivalDetail(festival)
}

export function removeFestivalGame(
  festivalId: string,
  gameId: string
): FestivalDetailView {
  requireRole("ADMIN")
  const festival = festivalById(festivalId)
  assertFestivalEditable(festival)
  const index = festival.games.findIndex((entry) => entry.game_id === gameId)
  if (index === -1) {
    throw new MockRuleError(
      404,
      "GAME_NOT_IN_FESTIVAL",
      "That game is not in this festival"
    )
  }
  festival.games.splice(index, 1)
  festival.game_count = festival.games.length
  save()
  return toFestivalDetail(festival)
}

export function startFestival(festivalId: string): FestivalDetailView {
  requireRole("ADMIN")
  const festival = festivalById(festivalId)
  if (festival.state !== "DRAFT") {
    throw new MockRuleError(
      409,
      "FESTIVAL_WRONG_STATE",
      `Cannot start from ${festival.state}`
    )
  }
  if (festival.games.length === 0) {
    throw new MockRuleError(
      422,
      "FESTIVAL_HAS_NO_GAMES",
      "Add at least one game first"
    )
  }
  festival.state = "ACTIVE"
  festival.started_at = iso()

  // Requirement 1.9: platform-wide. Every account is told, mirroring
  // festival-service's call to auth-profile-service for the full user directory.
  for (const account of db.users) {
    notify(
      account.user_id,
      "FESTIVAL_STARTED",
      `${festival.name} is live`,
      festival.description,
      { type: "FESTIVAL", id: festival.id }
    )
  }
  save()
  return toFestivalDetail(festival)
}

export function endFestival(festivalId: string): FestivalDetailView {
  requireRole("ADMIN")
  const festival = festivalById(festivalId)
  if (festival.state !== "ACTIVE") {
    throw new MockRuleError(
      409,
      "FESTIVAL_WRONG_STATE",
      `Cannot end from ${festival.state}`
    )
  }
  festival.state = "ENDED"
  festival.ended_at = iso()
  save()
  return toFestivalDetail(festival)
}

export function cancelFestival(festivalId: string): FestivalDetailView {
  requireRole("ADMIN")
  const festival = festivalById(festivalId)
  if (festival.state !== "DRAFT" && festival.state !== "ACTIVE") {
    throw new MockRuleError(
      409,
      "FESTIVAL_WRONG_STATE",
      `Cannot cancel from ${festival.state}`
    )
  }
  festival.state = "CANCELLED"
  save()
  return toFestivalDetail(festival)
}

// --- community (requirement 1.8) --------------------------------------------

function commentsOf(postId: string): Comment[] {
  return db.comments[postId] ?? []
}

function communityPostById(postId: string): Post {
  const post = db.posts.find((candidate) => candidate.id === postId)
  if (!post) throw new MockRuleError(404, "NOT_FOUND", "No such post")
  return post
}

function paginateCursor<T extends { id: string }>(
  items: T[],
  cursor: string | null,
  limit: number
): { items: T[]; next_cursor: string | null; has_more: boolean } {
  const startIndex = cursor
    ? Math.max(0, items.findIndex((item) => item.id === cursor) + 1)
    : 0
  const page = items.slice(startIndex, startIndex + limit)
  const hasMore = startIndex + limit < items.length
  return {
    items: page,
    next_cursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    has_more: hasMore,
  }
}

function sumReactions(reactions: Record<string, number>): number {
  return Object.values(reactions).reduce((total, count) => total + count, 0)
}

function sortPosts(posts: Post[], sort: FeedSort): Post[] {
  const sorted = [...posts]
  if (sort === "most_viewed") {
    sorted.sort((a, b) => b.view_count - a.view_count)
  } else if (sort === "most_reacted") {
    sorted.sort((a, b) => sumReactions(b.reactions) - sumReactions(a.reactions))
  } else {
    sorted.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }
  return sorted
}

export function gameFeed(
  gameId: string,
  filters: { sort?: FeedSort; cursor?: string | null; limit?: number }
) {
  const visible = db.posts.filter(
    (post) => post.game_id === gameId && post.status === "ACTIVE"
  )
  const sorted = sortPosts(visible, filters.sort ?? "newest")
  return paginateCursor(sorted, filters.cursor ?? null, filters.limit ?? 20)
}

export function exploreFeed(filters: {
  sort?: FeedSort
  cursor?: string | null
  limit?: number
}) {
  const visible = db.posts.filter((post) => post.status === "ACTIVE")
  const sorted = sortPosts(visible, filters.sort ?? "newest")
  return paginateCursor(sorted, filters.cursor ?? null, filters.limit ?? 20)
}

export function searchCommunityPosts(
  q: string,
  filters: { cursor?: string | null; limit?: number }
) {
  const query = q.trim().toLowerCase()
  const matches = db.posts.filter(
    (post) =>
      post.status === "ACTIVE" &&
      (post.body.toLowerCase().includes(query) ||
        post.tags.some((tag) => tag.toLowerCase().includes(query)))
  )
  return paginateCursor(
    sortPosts(matches, "newest"),
    filters.cursor ?? null,
    filters.limit ?? 20
  )
}

export function viewCommunityPost(postId: string): Post {
  const post = communityPostById(postId)
  post.view_count += 1
  save()
  return post
}

function attachmentKind(file: File): "IMAGE" | "VIDEO" | "FILE" {
  if (file.type.startsWith("image/")) return "IMAGE"
  if (file.type.startsWith("video/")) return "VIDEO"
  return "FILE"
}

export function createCommunityPost(input: {
  game_id: string
  body?: string
  spoiler?: boolean
  tags?: string[]
  files?: File[]
}): Post {
  const user = currentUser()
  const body = (input.body ?? "").trim()
  if (body.length > 5000) {
    throw new MockRuleError(400, "VALIDATION_FAILED", "At most 5000 characters")
  }
  const post: Post = {
    id: id("post"),
    game_id: input.game_id,
    author_id: user.user_id,
    body,
    spoiler: input.spoiler ?? false,
    tags: (input.tags ?? []).slice(0, 10),
    // Real object URLs, so an attached picture actually renders in the demo —
    // released when the tab closes, same as any other blob: URL's lifetime.
    attachments: (input.files ?? []).map((file) => ({
      id: id("att"),
      kind: attachmentKind(file),
      media_ref: URL.createObjectURL(file),
      status: "READY",
    })),
    reactions: {},
    comment_count: 0,
    view_count: 0,
    feedback_score: 0,
    status: "ACTIVE",
    created_at: iso(),
    edited_at: null,
  }
  db.posts.unshift(post)
  db.comments[post.id] = []
  save()
  return post
}

export function editCommunityPost(
  postId: string,
  body: { body?: string | null; spoiler?: boolean; tags?: string[] }
): Post {
  const user = currentUser()
  const post = communityPostById(postId)
  if (post.author_id !== user.user_id) {
    throw new MockRuleError(403, "PERMISSION_DENIED", "That post is not yours")
  }
  if (post.status !== "ACTIVE") {
    throw new MockRuleError(409, "CONFLICT", "This post is no longer editable")
  }
  if (body.body !== undefined) post.body = (body.body ?? "").trim()
  if (body.spoiler !== undefined) post.spoiler = body.spoiler
  if (body.tags !== undefined) post.tags = body.tags.slice(0, 10)
  post.edited_at = iso()
  save()
  return post
}

export function deleteCommunityPost(postId: string): void {
  const user = currentUser()
  const post = communityPostById(postId)
  const staff = user.role === "SUPPORT" || user.role === "ADMIN"
  if (post.author_id !== user.user_id && !staff) {
    throw new MockRuleError(403, "PERMISSION_DENIED", "That post is not yours")
  }
  post.status =
    staff && post.author_id !== user.user_id
      ? "REMOVED_BY_MODERATION"
      : "DELETED"
  save()
}

export function listComments(
  postId: string,
  cursor: string | null,
  limit: number
) {
  const list = commentsOf(postId).filter(
    (comment) => comment.status === "ACTIVE"
  )
  const sorted = [...list].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return paginateCursor(sorted, cursor, limit)
}

export function addCommunityComment(postId: string, body: string): Comment {
  const user = currentUser()
  const post = communityPostById(postId)
  if (post.status !== "ACTIVE") {
    throw new MockRuleError(
      409,
      "CONFLICT",
      "This post no longer accepts comments"
    )
  }
  const text = body.trim()
  if (!text || text.length > 1000) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "Between 1 and 1000 characters"
    )
  }
  const comment: Comment = {
    id: id("cmt"),
    post_id: postId,
    author_id: user.user_id,
    body: text,
    status: "ACTIVE",
    created_at: iso(),
    edited_at: null,
  }
  db.comments[postId] = [...commentsOf(postId), comment]
  post.comment_count += 1
  save()
  return comment
}

function findCommunityComment(commentId: string): {
  postId: string
  comment: Comment
} {
  for (const [postId, comments] of Object.entries(db.comments)) {
    const comment = comments.find((candidate) => candidate.id === commentId)
    if (comment) return { postId, comment }
  }
  throw new MockRuleError(404, "NOT_FOUND", "No such comment")
}

export function editCommunityComment(commentId: string, body: string): Comment {
  const user = currentUser()
  const { comment } = findCommunityComment(commentId)
  if (comment.author_id !== user.user_id) {
    throw new MockRuleError(
      403,
      "PERMISSION_DENIED",
      "That comment is not yours"
    )
  }
  const text = body.trim()
  if (!text || text.length > 1000) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "Between 1 and 1000 characters"
    )
  }
  comment.body = text
  comment.edited_at = iso()
  save()
  return comment
}

export function deleteCommunityComment(commentId: string): void {
  const user = currentUser()
  const { postId, comment } = findCommunityComment(commentId)
  const staff = user.role === "SUPPORT" || user.role === "ADMIN"
  if (comment.author_id !== user.user_id && !staff) {
    throw new MockRuleError(
      403,
      "PERMISSION_DENIED",
      "That comment is not yours"
    )
  }
  comment.status =
    staff && comment.author_id !== user.user_id
      ? "REMOVED_BY_MODERATION"
      : "DELETED"
  const post = db.posts.find((candidate) => candidate.id === postId)
  if (post) post.comment_count = Math.max(0, post.comment_count - 1)
  save()
}

function reactionSummaryOf(postId: string) {
  const user = currentUser()
  const post = communityPostById(postId)
  return {
    post_id: postId,
    reactions: post.reactions,
    total: sumReactions(post.reactions),
    my_reaction: db.postReactions[postId]?.[user.user_id] ?? null,
  }
}

/** PUT semantics: re-sending the currently-held emoji clears it, matching the
 *  real `PUT`/`DELETE` pair on `.../reactions`. */
export function setPostReaction(postId: string, emoji: string) {
  const user = currentUser()
  const post = communityPostById(postId)
  if (!(REACTION_EMOJI as readonly string[]).includes(emoji)) {
    throw new MockRuleError(
      422,
      "INVALID_ARGUMENT",
      "Not a recognised reaction"
    )
  }
  const perPost = db.postReactions[postId] ?? {}
  const previous = perPost[user.user_id]

  if (previous === emoji) {
    delete perPost[user.user_id]
    post.reactions[emoji] = Math.max(0, (post.reactions[emoji] ?? 0) - 1)
  } else {
    if (previous) {
      post.reactions[previous] = Math.max(
        0,
        (post.reactions[previous] ?? 0) - 1
      )
    }
    perPost[user.user_id] = emoji
    post.reactions[emoji] = (post.reactions[emoji] ?? 0) + 1
  }
  db.postReactions[postId] = perPost
  post.feedback_score = sumReactions(post.reactions)
  save()
  return reactionSummaryOf(postId)
}

export function clearPostReaction(postId: string) {
  const user = currentUser()
  const post = communityPostById(postId)
  const perPost = db.postReactions[postId] ?? {}
  const previous = perPost[user.user_id]
  if (previous) {
    delete perPost[user.user_id]
    post.reactions[previous] = Math.max(0, (post.reactions[previous] ?? 0) - 1)
    post.feedback_score = sumReactions(post.reactions)
  }
  db.postReactions[postId] = perPost
  save()
  return reactionSummaryOf(postId)
}

/** Reporting stays open to a banned user — the rule only shuts off posting. */
export function reportCommunityPost(postId: string, reason: string): Report {
  const user = currentUser()
  communityPostById(postId)
  const text = reason.trim()
  if (text.length < 1 || text.length > 1000) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "Between 1 and 1000 characters"
    )
  }
  const report: Report = {
    id: id("rpt"),
    target_type: "POST",
    target_id: postId,
    reporter_id: user.user_id,
    reason: text,
    status: "OPEN",
    resolved_by: null,
    resolution_note: null,
    created_at: iso(),
    resolved_at: null,
  }
  db.communityReports.unshift(report)
  save()
  return report
}

export function reportCommunityComment(
  commentId: string,
  reason: string
): Report {
  const user = currentUser()
  findCommunityComment(commentId)
  const text = reason.trim()
  if (text.length < 1 || text.length > 1000) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "Between 1 and 1000 characters"
    )
  }
  const report: Report = {
    id: id("rpt"),
    target_type: "COMMENT",
    target_id: commentId,
    reporter_id: user.user_id,
    reason: text,
    status: "OPEN",
    resolved_by: null,
    resolution_note: null,
    created_at: iso(),
    resolved_at: null,
  }
  db.communityReports.unshift(report)
  save()
  return report
}

export function communityModerationQueue(cursor: string | null, limit: number) {
  requireRole("SUPPORT", "ADMIN")
  const open = db.communityReports.filter((report) => report.status === "OPEN")
  return paginateCursor(open, cursor, limit)
}

export function resolveCommunityReport(
  reportId: string,
  action: ResolutionAction,
  note: string
): Report {
  const user = requireRole("SUPPORT", "ADMIN")
  const report = db.communityReports.find(
    (candidate) => candidate.id === reportId
  )
  if (!report) throw new MockRuleError(404, "NOT_FOUND", "No such report")
  if (report.status !== "OPEN") {
    throw new MockRuleError(409, "CONFLICT", "That report was already resolved")
  }
  if (!note.trim()) {
    throw new MockRuleError(
      400,
      "VALIDATION_FAILED",
      "A resolution needs a note"
    )
  }

  if (action === "REMOVE") {
    if (report.target_type === "POST") {
      const post = db.posts.find(
        (candidate) => candidate.id === report.target_id
      )
      if (post) post.status = "REMOVED_BY_MODERATION"
    } else {
      const { postId, comment } = findCommunityComment(report.target_id)
      comment.status = "REMOVED_BY_MODERATION"
      const post = db.posts.find((candidate) => candidate.id === postId)
      if (post) post.comment_count = Math.max(0, post.comment_count - 1)
    }
  }

  report.status =
    action === "REMOVE" ? "RESOLVED_REMOVED" : "RESOLVED_DISMISSED"
  report.resolved_by = user.user_id
  report.resolution_note = note.trim()
  report.resolved_at = iso()
  save()
  return report
}
