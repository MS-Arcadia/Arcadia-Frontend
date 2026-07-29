import type {
  AxiosAdapter,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios"

import { API } from "@/lib/api-paths"
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

route("get", API.auth.profile(":id"), ({ params }) => mock.userById(params[0]))

route("post", API.auth.requestRole, ({ body }) =>
  mock.requestRole(str(body.requested_role, "DEVELOPER") as Role)
)

route("get", API.auth.users, () => ({
  items: mock.allUsers(),
  roleRequests: mock.roleRequests(),
}))

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

route("get", API.catalog.library, ({ query }) => {
  const user = mock.currentUser()
  const items = db.ownerships
    .filter(
      (entry) => entry.owner_id === user.user_id && entry.status === "ACTIVE"
    )
    .map((ownership) => ({
      ownership,
      game: db.games.find((game) => game.id === ownership.game_id) ?? null,
    }))
    .filter((entry) => entry.game !== null)
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

route("get", API.catalog.promotions(":id"), ({ params }) => {
  const items = mock.promotionsOf(params[0])
  return { items, total: items.length, limit: items.length, offset: 0 }
})
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
route("get", API.wallet.ledger, ({ query }) =>
  paginate(db.ledgers[mock.currentUser().user_id] ?? [], query)
)
route("get", API.wallet.holds, ({ query }) => paginate([], query))
route("post", API.wallet.topUp, ({ body }) => {
  const amount = body.amount as
    { amount_minor?: string; currency?: string } | undefined
  return mock.topUp({
    amount_minor: String(amount?.amount_minor ?? "0"),
    currency: String(amount?.currency ?? "IRR"),
  })
})

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
