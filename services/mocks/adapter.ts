import type {
  AxiosAdapter,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios"

import { API } from "@/lib/api-paths"
import type { Game } from "@/types/catalog.api.type"
import type { Page, ProblemDocument, Role } from "@/types/common.api.type"

import * as mock from "./db"
import { MockRuleError, db } from "./db"

/**
 * A real axios adapter rather than a separate fake client.
 *
 * Nothing above this line knows it is mocked: the request interceptor still
 * attaches the token, the response interceptor still maps RFC 7807 documents to
 * toasts, TanStack Query still sees genuine promises and real `AxiosError`s. When
 * `NEXT_PUBLIC_API_MODE=live` this file is replaced by the network and no call site
 * changes.
 *
 * Failures are therefore returned as problem documents with the same `reason`
 * codes the services emit, not as thrown strings.
 */

type Handler = (context: {
  body: Record<string, unknown>
  query: URLSearchParams
  params: string[]
}) => unknown

interface Route {
  method: string
  pattern: RegExp
  handler: Handler
}

const routes: Route[] = []

/** Header lookup that does not care how axios cased the name. */
function idempotencyKey(config: { headers?: unknown }): string {
  const headers = (config.headers ?? {}) as Record<string, unknown>
  const found = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === "idempotency-key"
  )
  return typeof found?.[1] === "string" ? found[1] : ""
}

function route(method: string, path: string, handler: Handler): void {
  // `:id` becomes a capture group; everything else is matched literally.
  const pattern = new RegExp(
    `^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:\w+/g, "([^/]+)")}$`
  )
  routes.push({ method, pattern, handler })
}

function paginate<T>(items: T[], query: URLSearchParams): Page<T> {
  const limit = Number(query.get("limit") ?? 20)
  const offset = Number(query.get("offset") ?? 0)
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  }
}

/** The Go services' pagination: 1-based pages, and the array named after its
 *  contents rather than a generic `items`. */
function pageNumbered<T>(
  items: T[],
  query: URLSearchParams,
  key: string
): Record<string, unknown> {
  const page = Math.max(1, Number(query.get("page") ?? 1))
  const pageSize = Number(query.get("page_size") ?? 20)
  const start = (page - 1) * pageSize
  return {
    [key]: items.slice(start, start + pageSize),
    total_items: items.length,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(items.length / pageSize)),
  }
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

// --- auth ------------------------------------------------------------------

route("post", API.auth.login, ({ body }) => {
  const user = mock.signIn(str(body.email), str(body.password))
  // Shaped like the platform's token so anything decoding it for display works.
  // The signature is not real — here the mock is the authority, not the token.
  return {
    access_token: `mock.${user.user_id}.access`,
    refresh_token: `mock.${user.user_id}.refresh`,
    token_type: "bearer",
  }
})

route("post", API.auth.refresh, ({ body }) => {
  const refresh = str(body.refresh_token)
  if (!refresh.startsWith("mock.") || !refresh.endsWith(".refresh")) {
    throw new MockRuleError(401, "TOKEN_INVALID", "Invalid refresh token.")
  }
  const userId = refresh.slice("mock.".length, -".refresh".length)
  const user = db.users.find((candidate) => candidate.user_id === userId)
  if (!user || user.state !== "ACTIVE") {
    throw new MockRuleError(401, "TOKEN_INVALID", "Invalid refresh token.")
  }
  db.sessionUserId = user.user_id
  mock.save()
  return {
    access_token: `mock.${user.user_id}.access`,
    refresh_token: refresh,
    token_type: "bearer",
  }
})

route("post", API.auth.register, ({ body }) => {
  const user = mock.registerUser(
    str(body.email),
    str(body.password),
    str(body.display_name)
  )
  // PENDING, and no token — requirement 1.1 puts an approval between registering
  // and signing in, and a mock that returned a session would hide the whole state.
  return { user_id: user.user_id, email: user.email, state: user.state }
})

route("post", API.auth.logout, () => {
  mock.signOut()
  return {}
})

route("get", API.auth.profile(":id"), ({ params }) =>
  mock.publicProfile(params[0])
)

route("post", API.auth.hideGame, ({ body }) => {
  mock.hideOwnedGame(str(body.game_id))
  return {}
})

route("post", API.auth.unhideGame, ({ body }) => {
  mock.unhideOwnedGame(str(body.game_id))
  return {}
})

route("post", API.auth.setAvatar, ({ body }) => {
  mock.setAvatar(str(body.avatar_url))
  return {}
})

route("post", API.auth.requestRole, ({ body }) =>
  mock.requestRole(str(body.requested_role, "DEVELOPER") as Role)
)

// Two routes, because the service has two. The mock used to return them as one
// combined object, which is the shape no deployment ever produced — and why the
// admin screen looked fine here and listed nobody against the real platform.
route("get", API.auth.users, () => mock.allUsers())

// Exact email, or an exact display name when only one person has it — the same rules
// auth-profile-service applies, so the gift box behaves here the way it does live.
route("get", API.auth.lookupRecipient, ({ query }) => {
  const wanted = (query.get("q") ?? "").trim().toLowerCase()
  if (!wanted)
    throw new MockRuleError(404, "NOT_FOUND", "No account matches that")

  const active = mock.allUsers().filter((user) => user.state === "ACTIVE")
  const matches = wanted.includes("@")
    ? active.filter((user) => user.email.toLowerCase() === wanted)
    : active.filter((user) => user.display_name.toLowerCase() === wanted)

  if (matches.length === 0) {
    throw new MockRuleError(404, "NOT_FOUND", "No account matches that")
  }
  if (matches.length > 1) {
    throw new MockRuleError(
      409,
      "RECIPIENT_NOT_UNIQUE",
      "More than one account is called that"
    )
  }
  return {
    user_id: matches[0].user_id,
    display_name: matches[0].display_name,
    avatar_url: "",
  }
})

route("get", API.auth.pendingRoleRequests, () =>
  mock.roleRequests().filter((request) => request.status === "PENDING")
)

route("post", API.auth.decideRegistration(":id"), ({ params, body }) =>
  mock.decideRegistration(params[0], body.approve === true)
)

route("post", API.auth.decideRoleRequest(":id"), ({ params, body }) =>
  mock.decideRoleRequest(params[0], body.approve === true, str(body.note))
)

route("post", API.auth.grantRole(":id"), ({ params, body }) =>
  mock.grantRole(params[0], str(body.new_role, "DEVELOPER") as Role)
)

route("post", API.auth.ban(":id"), ({ params, body }) =>
  mock.setBanned(params[0], true, str(body.reason))
)

route("post", API.auth.unban(":id"), ({ params }) =>
  mock.setBanned(params[0], false, "")
)

// --- catalog: the storefront ----------------------------------------------

route("get", API.catalog.games, ({ query }) => {
  const search = (query.get("q") ?? "").trim().toLowerCase()
  const genre = query.get("genre")
  const state = query.get("state")

  let games = db.games.filter(
    (game) =>
      (game.state === "PUBLISHED" || game.state === "PREORDER") &&
      !game.withdrawn_at
  )
  if (state) games = games.filter((game) => game.state === state)
  if (genre) games = games.filter((game) => game.genres.includes(genre))
  if (search) {
    games = games.filter(
      (game) =>
        game.title.toLowerCase().includes(search) ||
        game.description.toLowerCase().includes(search)
    )
  }

  const sort = query.get("sort")
  if (sort === "price-asc") {
    games = [...games].sort(
      (a, b) =>
        Number(mock.parse(a.effective_price)) -
        Number(mock.parse(b.effective_price))
    )
  } else if (sort === "discount") {
    games = [...games].sort((a, b) => b.discount_bps - a.discount_bps)
  }

  return paginate(games, query)
})

// Declared before `/games/:id` — otherwise "mine" is matched as a game id.
route("get", API.catalog.mine, () => {
  const games = mock.myGames()
  return { items: games, total: games.length, limit: games.length, offset: 0 }
})

route("get", API.catalog.gameDetail(":id"), ({ params }) => ({
  ...mock.gameById(params[0]),
  reviews: mock.reviewsOf(params[0]),
  promotions: mock.promotionsOf(params[0]),
}))

route("get", API.catalog.game(":id"), ({ params }) => ({
  ...mock.gameById(params[0]),
  reviews: mock.reviewsOf(params[0]),
  promotions: mock.promotionsOf(params[0]),
}))

// `Page[OwnershipView]` — the ownership records alone, which is all catalog-service returns.
// This used to answer `{ ownership, game }` pairs, and the library page read the game
// straight out of them; against the real service that game is undefined and the page throws.
// A caller that needs the title fetches it by `game_id`, as the page now does.
route("get", API.catalog.library, ({ query }) => {
  const user = mock.currentUser()
  const items = db.ownerships.filter(
    (entry) => entry.owner_id === user.user_id && entry.status === "ACTIVE"
  )
  return paginate(items, query)
})

route("get", API.catalog.reviewQueue, ({ query }) =>
  paginate(mock.reviewQueue(), query)
)

// --- catalog: the publishing workflow -------------------------------------

route("post", API.catalog.games, ({ body }) =>
  mock.registerGame({
    title: str(body.title),
    description: str(body.description),
    min_requirements: str(body.min_requirements),
    genres: Array.isArray(body.genres) ? (body.genres as string[]) : [],
  })
)

route("post", API.catalog.versions(":id"), ({ params, body }) =>
  mock.addVersion(
    params[0],
    str(body.version, "1.0.0"),
    Number(body.size_bytes ?? 0)
  )
)

route("post", API.media.upload, ({ body }) => {
  const file = body.file
  if (!(file instanceof File)) {
    throw new MockRuleError(400, "MEDIA_EMPTY", "the uploaded file is empty")
  }
  return mock.uploadMedia(file, str(body.kind, "IMAGE"), str(body.reference_id))
})

route("post", API.catalog.media(":id"), ({ params, body }) =>
  mock.addGameMedia(
    params[0],
    str(body.kind, "TEASER") === "IMAGE" ? "IMAGE" : "TEASER",
    str(body.media_ref)
  )
)

route("post", API.catalog.submit(":id"), ({ params }) =>
  mock.submitGame(params[0])
)
route("post", API.catalog.reviewStart(":id"), ({ params }) =>
  mock.startReview(params[0])
)
route("post", API.catalog.reviewApprove(":id"), ({ params, body }) =>
  mock.approveGame(params[0], str(body.note))
)
route("post", API.catalog.reviewReject(":id"), ({ params, body }) =>
  mock.rejectGame(params[0], str(body.note))
)
route("post", API.catalog.appeal(":id"), ({ params, body }) =>
  mock.appealGame(params[0], str(body.note))
)
route("post", API.catalog.suggestPrice(":id"), ({ params, body }) =>
  mock.suggestPrice(params[0], Number(body.amount_minor ?? 0))
)
route("post", API.catalog.price(":id"), ({ params, body }) =>
  mock.setFinalPrice(params[0], Number(body.amount_minor ?? 0))
)
route("post", API.catalog.publish(":id"), ({ params }) =>
  mock.publishGame(params[0])
)
route("post", API.catalog.withdraw(":id"), ({ params, body }) =>
  mock.withdrawGame(params[0], str(body.reason))
)
route("post", API.catalog.relist(":id"), ({ params }) =>
  mock.relistGame(params[0])
)

// No GET here: the real service has none — every promotions route answers with the
// game, and `promotions` is a field on it (see the /detail route above). getPromotions
// reads it from there now.
route("post", API.catalog.promotions(":id"), ({ params, body }) =>
  mock.proposePromotion(
    params[0],
    Number(body.discount_bps ?? 0),
    str(body.starts_at, new Date().toISOString()),
    str(body.ends_at, new Date().toISOString()),
    str(body.note)
  )
)
route("post", API.catalog.approvePromotion(":id", ":pid"), ({ params }) =>
  mock.decidePromotion(params[0], params[1], true)
)
route("post", API.catalog.rejectPromotion(":id", ":pid"), ({ params }) =>
  mock.decidePromotion(params[0], params[1], false)
)

// --- orders ----------------------------------------------------------------

route("get", API.orders.list, ({ query }) => {
  const user = mock.currentUser()
  return paginate(
    db.orders.filter((order) => order.buyer_id === user.user_id),
    query
  )
})

route("get", API.orders.detail(":id"), ({ params }) => {
  const user = mock.currentUser()
  const order = db.orders.find(
    (candidate) =>
      candidate.id === params[0] && candidate.buyer_id === user.user_id
  )
  if (!order) throw new MockRuleError(404, "NOT_FOUND", "No such order")
  return order
})

route("post", API.orders.place, ({ body }) => mock.buy(str(body.game_id)))
route("post", API.orders.gift, ({ body }) =>
  mock.gift(str(body.game_id), str(body.recipient_id), str(body.message))
)
route("post", API.orders.preorder, ({ body }) =>
  mock.preorder(str(body.game_id))
)
route("post", API.orders.instalment, ({ body }) => {
  const { order } = mock.startInstalmentPlan(
    str(body.game_id),
    Number(body.instalments ?? 3),
    Number(body.interval_days ?? 30)
  )
  return order
})
route("post", API.orders.refund(":id"), ({ params }) => mock.refund(params[0]))

// `pay-next` is declared before the plan itself so the longer path wins.
route("post", `${API.orders.plan(":id")}/pay-next`, ({ params }) =>
  mock.payNextInstalment(params[0])
)

route("get", API.orders.plan(":id"), ({ params }) => {
  const user = mock.currentUser()
  const plan = db.plans.find(
    (candidate) =>
      candidate.order_id === params[0] && candidate.buyer_id === user.user_id
  )
  if (!plan)
    throw new MockRuleError(404, "NOT_FOUND", "This order has no payment plan")
  return plan
})

// --- wallet ----------------------------------------------------------------

route("get", API.wallet.me, () => mock.walletOf(mock.currentUser().user_id))
// The wallet service paginates by page number, not limit/offset, and names the
// array after what is in it. Returning a `Page<T>` here would have hidden the
// mismatch that left the real ledger permanently empty.
route("get", API.wallet.ledger, ({ query }) =>
  pageNumbered(db.ledgers[mock.currentUser().user_id] ?? [], query, "entries")
)
route("get", API.wallet.holds, ({ query }) => pageNumbered([], query, "holds"))
// Starting a top-up credits nothing and hands back a redirect, exactly as the
// wallet service does. The old route credited immediately and returned the new
// balance — a shape no deployment has ever produced, which is how the demo
// showed a working top-up while the real path 404'd.
route("post", API.wallet.charges, ({ body }) => {
  const amount = body.amount as
    { amount_minor?: string; currency?: string } | undefined
  return mock.initiateCharge({
    amount_minor: String(amount?.amount_minor ?? "0"),
    currency: String(amount?.currency ?? "IRR"),
  })
})

route("post", API.wallet.redeemGiftCard, ({ body }) =>
  mock.redeemGiftCard(str(body.code))
)

// Support and Admin mint cards; requirement 1.1. There was no route here because
// nothing in the app could issue one — only redeem, against codes that had to be
// seeded by hand.
route("post", API.wallet.issueGiftCard, ({ body }) => {
  const value = body.value as { amount_minor?: string; currency?: string }
  return mock.issueGiftCards(
    {
      amount_minor: str(value?.amount_minor, "0"),
      currency: str(value?.currency, "IRR"),
    },
    Number(body.quantity ?? 1),
    str(body.note)
  )
})

// Page-numbered and named after its contents, like the ledger beside it — wallet-service
// paginates this way and `paginate()` would have produced `items`, which the screen would
// then read as empty forever.
route("get", API.wallet.giftCards, ({ query }) =>
  pageNumbered(mock.listGiftCards(), query, "gift_cards")
)

// --- the sandbox bank (mock mode only) --------------------------------------
//
// Against a real platform the redirect goes to payment-service's /mock-bank/pay
// and the wallet is credited when its confirmation reaches Kafka. With no
// backend there is nothing to redirect to, so these two stand in for it — the
// flow the user walks through is the same one, which is the point.

route("get", API.mockBank.charge(":id"), ({ params }) => {
  const charge = mock.chargeById(params[0])
  return { payment_intent_id: params[0], ...charge }
})

route("post", API.mockBank.confirm(":id"), ({ params }) =>
  mock.settleCharge(params[0])
)

// --- notifications ---------------------------------------------------------

route("get", API.notifications.list, ({ query }) => {
  const all = mock.notificationsOf(mock.currentUser().user_id)
  const unreadOnly = query.get("unread_only") === "true"
  return paginate(unreadOnly ? all.filter((note) => !note.read) : all, query)
})

route("get", API.notifications.unreadCount, () => ({
  unread: mock
    .notificationsOf(mock.currentUser().user_id)
    .filter((note) => !note.read).length,
}))

route("post", API.notifications.readAll, () => {
  const unread = mock
    .notificationsOf(mock.currentUser().user_id)
    .filter((note) => !note.read)
  for (const note of unread) {
    note.read = true
    note.read_at = new Date().toISOString()
  }
  mock.save()
  return { marked: unread.length }
})

route("post", API.notifications.read(":id"), ({ params }) => {
  const note = mock
    .notificationsOf(mock.currentUser().user_id)
    .find((candidate) => candidate.id === params[0])
  if (!note) throw new MockRuleError(404, "NOT_FOUND", "Not found")
  if (!note.read) {
    note.read = true
    note.read_at = new Date().toISOString()
    mock.save()
  }
  return note
})

// --- marketplace (requirement 1.6) ------------------------------------------

route("get", API.marketplace.items, ({ query }) =>
  paginate(
    mock.marketItemsOf({ game_id: query.get("game_id") ?? undefined }),
    query
  )
)
route("get", API.marketplace.item(":id"), ({ params }) =>
  mock.marketItemById(params[0])
)
route("get", API.marketplace.book(":id"), ({ params }) =>
  mock.marketBook(params[0])
)
route("post", API.marketplace.items, ({ body }) =>
  mock.createMarketItem({
    game_id: str(body.game_id),
    title: str(body.title),
    description: str(body.description),
    image_url: str(body.image_url),
    buy_value: str(body.buy_value, "0"),
    sell_value: str(body.sell_value, "0"),
  })
)
route("post", API.marketplace.distribute(":id"), ({ params, body }) =>
  mock.distributeMarketItem(params[0], Number(body.count ?? 0))
)
route("get", API.marketplace.orders, ({ query }) =>
  paginate(mock.myMarketOrders(), query)
)
route("post", API.marketplace.orders, ({ body }) =>
  mock.placeMarketOrder({
    item_id: str(body.item_id),
    side: str(body.side, "BUY") as "BUY" | "SELL",
    price: str(body.price, "0"),
  })
)
route("delete", API.marketplace.cancelOrder(":id"), ({ params }) =>
  mock.cancelMarketOrder(params[0])
)
route("get", API.marketplace.trades, ({ query }) =>
  paginate(mock.myMarketTrades(), query)
)
route("get", API.marketplace.holdings(":id"), ({ params }) => ({
  items: mock.holdingsOf(params[0]),
  total: mock.holdingsOf(params[0]).length,
}))
route("post", API.marketplace.runMatching, () => mock.runMarketMatching())

// --- reviews (requirement 1.7) ----------------------------------------------

route("post", API.reviews.create, ({ body }) =>
  mock.createUserReview({
    game_id: str(body.game_id),
    text: str(body.text),
    sentiment: str(body.sentiment, "LIKE") as "LIKE" | "DISLIKE",
  })
)
route("put", API.reviews.edit(":id"), ({ params, body }) =>
  mock.editUserReview(
    params[0],
    str(body.text),
    body.sentiment ? (str(body.sentiment) as "LIKE" | "DISLIKE") : undefined
  )
)
route("delete", API.reviews.remove(":id"), ({ params }) => {
  mock.deleteUserReview(params[0])
  return {}
})
route("get", API.reviews.forGame(":id"), ({ params, query }) =>
  mock.gameReviews(params[0], {
    limit: query.get("limit") ? Number(query.get("limit")) : undefined,
    offset: query.get("offset") ? Number(query.get("offset")) : undefined,
    sort_by: (query.get("sort_by") ?? undefined) as
      "created_at" | "like_count" | "dislike_count" | undefined,
    sort_order: (query.get("sort_order") ?? undefined) as
      "asc" | "desc" | undefined,
  })
)
route("get", API.reviews.rating(":id"), ({ params }) =>
  mock.averageRating(params[0])
)
route("post", API.reviews.report(":id"), ({ params, body }) => {
  mock.reportUserReview(params[0], str(body.reason))
  return { message: "Review reported successfully" }
})
route("post", API.reviews.react(":id"), ({ params, body }) => {
  const reactionType = str(body.reaction_type).toUpperCase()
  if (reactionType !== "LIKE" && reactionType !== "DISLIKE") {
    throw new MockRuleError(
      400,
      "INVALID_ARGUMENT",
      "Invalid reaction type. Use LIKE or DISLIKE"
    )
  }
  mock.reactToUserReview(params[0], reactionType)
  return { message: `Reaction ${reactionType} added successfully` }
})
// Support/Admin only, per the real endpoint — but review-service's own API has
// no route to *discover* an open report's id, so nothing in this app's UI
// calls this today (see the frontend's known-gaps note). Registered anyway,
// against whatever report id a caller already has out of band, so the
// endpoint behaves correctly the day a listing route exists to drive it.
route(
  "post",
  API.reviews.resolveReport(":id", ":reportId"),
  ({ params, query }) => {
    mock.requireRole("SUPPORT", "ADMIN")
    if (query.get("delete_review") === "true") mock.deleteUserReview(params[0])
    return mock.gameReviews(params[0], {}).reviews[0] ?? {}
  }
)

// --- festivals (requirement 1.9) --------------------------------------------

route("get", API.festivals.list, ({ query }) =>
  mock.festivalsList({
    limit: query.get("limit") ? Number(query.get("limit")) : undefined,
    offset: query.get("offset") ? Number(query.get("offset")) : undefined,
  })
)
route("get", API.festivals.detail(":id"), ({ params }) =>
  mock.festivalDetail(params[0])
)
route("post", API.festivals.create, ({ body }) =>
  mock.createFestival({
    name: str(body.name),
    description: str(body.description),
    starts_at: str(body.starts_at),
    ends_at: str(body.ends_at),
  })
)
route("patch", API.festivals.reschedule(":id"), ({ params, body }) =>
  mock.rescheduleFestival(params[0], str(body.starts_at), str(body.ends_at))
)
route("post", API.festivals.addGame(":id"), ({ params, body }) =>
  mock.addFestivalGame(params[0], str(body.game_id))
)
route("delete", API.festivals.removeGame(":id", ":gameId"), ({ params }) =>
  mock.removeFestivalGame(params[0], params[1])
)
route("post", API.festivals.start(":id"), ({ params }) =>
  mock.startFestival(params[0])
)
route("post", API.festivals.end(":id"), ({ params }) =>
  mock.endFestival(params[0])
)
route("post", API.festivals.cancel(":id"), ({ params }) =>
  mock.cancelFestival(params[0])
)

// --- community (requirement 1.8) --------------------------------------------

route("get", API.community.gameFeed(":id"), ({ params, query }) =>
  mock.gameFeed(params[0], {
    sort: (query.get("sort") ?? undefined) as
      "newest" | "most_viewed" | "most_reacted" | undefined,
    cursor: query.get("cursor"),
    limit: query.get("limit") ? Number(query.get("limit")) : undefined,
  })
)
route("get", API.community.exploreFeed, ({ query }) =>
  mock.exploreFeed({
    sort: (query.get("sort") ?? undefined) as
      "newest" | "most_viewed" | "most_reacted" | undefined,
    cursor: query.get("cursor"),
    limit: query.get("limit") ? Number(query.get("limit")) : undefined,
  })
)
// Declared before `posts/:id` — otherwise "search" is read as a post id, the
// same collision community-service's own router has to avoid.
route("get", API.community.search, ({ query }) =>
  mock.searchCommunityPosts(query.get("q") ?? "", {
    cursor: query.get("cursor"),
    limit: query.get("limit") ? Number(query.get("limit")) : undefined,
  })
)
route("post", API.community.createPost, ({ body }) =>
  mock.createCommunityPost({
    game_id: str(body.game_id),
    body: str(body.body),
    spoiler: body.spoiler === true || body.spoiler === "true",
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
  })
)
route("post", API.community.createPostMultipart, ({ body }) =>
  mock.createCommunityPost({
    game_id: str(body.game_id),
    body: str(body.body),
    spoiler: body.spoiler === true || body.spoiler === "true",
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    files: Array.isArray(body.files) ? (body.files as File[]) : [],
  })
)
route("get", API.community.post(":id"), ({ params }) =>
  mock.viewCommunityPost(params[0])
)
route("get", API.community.topPosts(":id"), ({ params }) =>
  mock.topPostsByAuthor(params[0])
)
route("patch", API.community.editPost(":id"), ({ params, body }) =>
  mock.editCommunityPost(params[0], {
    body: typeof body.body === "string" ? body.body : undefined,
    spoiler: typeof body.spoiler === "boolean" ? body.spoiler : undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
  })
)
route("delete", API.community.deletePost(":id"), ({ params }) => {
  mock.deleteCommunityPost(params[0])
  return {}
})
route("get", API.community.comments(":id"), ({ params, query }) =>
  mock.listComments(
    params[0],
    query.get("cursor"),
    query.get("limit") ? Number(query.get("limit")) : 20
  )
)
route("post", API.community.comments(":id"), ({ params, body }) =>
  mock.addCommunityComment(params[0], str(body.body))
)
route("patch", API.community.editComment(":id"), ({ params, body }) =>
  mock.editCommunityComment(params[0], str(body.body))
)
route("delete", API.community.deleteComment(":id"), ({ params }) => {
  mock.deleteCommunityComment(params[0])
  return {}
})
route("put", API.community.reaction(":id"), ({ params, body }) =>
  mock.setPostReaction(params[0], str(body.emoji))
)
route("delete", API.community.reaction(":id"), ({ params }) =>
  mock.clearPostReaction(params[0])
)
route("post", API.community.reportPost(":id"), ({ params, body }) =>
  mock.reportCommunityPost(params[0], str(body.reason))
)
route("post", API.community.reportComment(":id"), ({ params, body }) =>
  mock.reportCommunityComment(params[0], str(body.reason))
)
route("get", API.community.moderationQueue, ({ query }) =>
  mock.communityModerationQueue(
    query.get("cursor"),
    query.get("limit") ? Number(query.get("limit")) : 20
  )
)
route("post", API.community.resolveReport(":id"), ({ params, body }) =>
  mock.resolveCommunityReport(
    params[0],
    str(body.action, "DISMISS") as "REMOVE" | "DISMISS",
    str(body.note)
  )
)

// --- recommendations (requirements §3.1) ------------------------------------
//
// The real service learns from purchase/review/game events over five minutes of
// batch runs; nothing here reproduces that. This is honestly a FALLBACK, same as
// the service's own answer when it has no signal yet for a user — "popular right
// now" rather than a lie about personalisation.

function publishedGames(): Game[] {
  return db.games.filter(
    (game) =>
      (game.state === "PUBLISHED" || game.state === "PREORDER") &&
      !game.withdrawn_at
  )
}

function toRecommendationItem(game: Game, rank: number, reasons: string[]) {
  return {
    game_id: game.id,
    title: game.title,
    genres: game.genres,
    score: Math.max(0, 1 - rank * 0.05),
    source: "FALLBACK" as const,
    rank,
    reasons,
  }
}

route("get", API.recommendations.mine, ({ query }) => {
  const user = mock.currentUser()
  const limit = query.get("limit") ? Number(query.get("limit")) : 10
  const items = publishedGames()
    .slice(0, limit)
    .map((game, i) => toRecommendationItem(game, i, ["Popular right now"]))
  return {
    user_id: user.user_id,
    source: "FALLBACK",
    generated_at: new Date().toISOString(),
    items,
  }
})

route("get", API.recommendations.forUser(":id"), ({ params, query }) => {
  const actor = mock.currentUser()
  const targetId = params[0]
  if (targetId !== actor.user_id) mock.requireRole("SUPPORT", "ADMIN")
  const limit = query.get("limit") ? Number(query.get("limit")) : 10
  const items = publishedGames()
    .slice(0, limit)
    .map((game, i) => toRecommendationItem(game, i, ["Popular right now"]))
  return {
    user_id: targetId,
    source: "FALLBACK",
    generated_at: new Date().toISOString(),
    items,
  }
})

route("get", API.recommendations.similar(":id"), ({ params, query }) => {
  const game = mock.gameById(params[0])
  const limit = query.get("limit") ? Number(query.get("limit")) : 6
  const items = publishedGames()
    .filter(
      (g) =>
        g.id !== game.id &&
        g.genres.some((genre) => game.genres.includes(genre))
    )
    .slice(0, limit)
    .map((g) => ({
      game_id: g.id,
      title: g.title,
      genres: g.genres,
      similarity:
        g.genres.filter((genre) => game.genres.includes(genre)).length /
        Math.max(g.genres.length, 1),
      shared_features: g.genres
        .filter((genre) => game.genres.includes(genre))
        .map((genre) => `genre:${genre}`),
    }))
  return { game_id: game.id, items }
})

// --- the adapter itself ----------------------------------------------------

/** Enough latency that loading states are visible while building, not enough to
 *  be annoying. */
const LATENCY_MS = 180

function problem(
  status: number,
  reason: string,
  detail: string
): ProblemDocument {
  return {
    type: `https://arcadia.local/problems/${reason.toLowerCase()}`,
    title: reason,
    status,
    detail,
    reason,
  }
}

const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))

  const method = (config.method ?? "get").toLowerCase()
  const raw = config.url ?? ""
  const [path, search = ""] = raw.split("?")
  const query = new URLSearchParams(search)
  for (const [key, value] of Object.entries(config.params ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value))
  }

  let body: Record<string, unknown> = {}
  if (typeof config.data === "string") {
    try {
      body = JSON.parse(config.data) as Record<string, unknown>
    } catch {
      body = {}
    }
  } else if (
    typeof FormData !== "undefined" &&
    config.data instanceof FormData
  ) {
    // community's multipart post: every scalar field arrives as a string, and
    // `files` can repeat — `getAll` is what a real multipart parser gives a
    // handler for a repeated field, so this mirrors that rather than losing
    // every file but the last.
    const form = config.data
    for (const [key, value] of form.entries()) {
      if (key === "files") continue
      body[key] = typeof value === "string" ? value : value
    }
    if (typeof body.tags === "string") {
      try {
        body.tags = JSON.parse(body.tags)
      } catch {
        body.tags = []
      }
    }
    body.files = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File)
    const single = form.get("file")
    if (single instanceof File) body.file = single
  } else if (config.data && typeof config.data === "object") {
    body = config.data as Record<string, unknown>
  }

  const respond = (status: number, data: unknown): AxiosResponse => ({
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  })

  const reject = (status: number, reason: string, message: string) =>
    // Rejected the way axios rejects, so the response interceptor and
    // `toApiError` treat it exactly like a real failure.
    Promise.reject(
      Object.assign(new Error(message), {
        isAxiosError: true,
        name: "AxiosError",
        config,
        response: respond(status, problem(status, reason, message)),
      })
    )

  // wallet-service refuses any operation that moves money without an Idempotency-Key, and
  // order-service calls it "mandatory, never defaulted". Enforced here for the same reason
  // the rest of this file enforces the platform's rules: the client shipped without ever
  // sending the header, and a mock that accepted the write is precisely what let that reach
  // production looking healthy. Only these two prefixes — auth's POST /login needs no key,
  // and pretending otherwise would be a different lie.
  if (
    method !== "get" &&
    (path.startsWith("/wallet/") || path.startsWith("/orders/")) &&
    !idempotencyKey(config)
  ) {
    return reject(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "an Idempotency-Key header is required for this request"
    )
  }

  for (const candidate of routes) {
    if (candidate.method !== method) continue
    const match = candidate.pattern.exec(path)
    if (!match) continue

    try {
      const data = candidate.handler({ body, query, params: match.slice(1) })
      return respond(method === "post" ? 201 : 200, data)
    } catch (error) {
      if (error instanceof MockRuleError) {
        return reject(error.status, error.reason, error.message)
      }
      throw error
    }
  }

  return reject(
    404,
    "NOT_FOUND",
    `No mock route for ${method.toUpperCase()} ${path}`
  )
}

export function installMockAdapter(instance: AxiosInstance): void {
  instance.defaults.adapter = adapter
}
