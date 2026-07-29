import type {
  AxiosAdapter,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios"

import { API } from "@/lib/api-paths"
import type { Page, ProblemDocument } from "@/types/common.api.type"

import {
  CURRENT_USER_ID,
  MockRuleError,
  buy,
  db,
  gift,
  ownedGameIds,
  preorder,
  refund,
  startInstalmentPlan,
  topUp,
} from "./db"

/**
 * A real axios adapter rather than a separate fake client.
 *
 * The point is that nothing above this line knows it is mocked: the request
 * interceptor still attaches the token, the response interceptor still maps RFC
 * 7807 documents to toasts, TanStack Query still sees genuine promises and real
 * `AxiosError`s. When `NEXT_PUBLIC_API_MODE=live` this file is replaced by the
 * network and no call site changes.
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

// --- auth ------------------------------------------------------------------

route("post", API.auth.login, ({ body }) => {
  const email = String(body.email ?? "")
  if (!email.includes("@") || String(body.password ?? "").length < 8) {
    throw new MockRuleError(
      401,
      "INVALID_CREDENTIALS",
      "That email and password do not match"
    )
  }
  db.signedIn = true
  db.user.email = email
  return {
    access_token: "mock.access.token",
    refresh_token: "mock.refresh.token",
    token_type: "bearer",
  }
})

route("post", API.auth.register, ({ body }) => ({
  user_id: CURRENT_USER_ID,
  email: String(body.email ?? ""),
  // PENDING, not ACTIVE — requirement 1.1 puts an approval between registering
  // and signing in, and a mock that returned ACTIVE would hide the whole state.
  state: "PENDING",
}))

route("post", API.auth.logout, () => {
  db.signedIn = false
  return {}
})

route("get", API.auth.me, () => db.user)

// --- catalog ---------------------------------------------------------------

route("get", API.catalog.games, ({ query }) => {
  const search = (query.get("q") ?? "").trim().toLowerCase()
  const genre = query.get("genre")
  const state = query.get("state")

  let games = db.games.filter(
    (game) => game.state === "PUBLISHED" || game.state === "PREORDER"
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
        Number(a.effective_price?.amount_minor ?? 0) -
        Number(b.effective_price?.amount_minor ?? 0)
    )
  } else if (sort === "discount") {
    games = [...games].sort((a, b) => b.discount_bps - a.discount_bps)
  }

  return paginate(games, query)
})

route("get", API.catalog.game(":id"), ({ params }) => {
  const game = db.games.find((g) => g.id === params[0])
  if (!game) throw new MockRuleError(404, "NOT_FOUND", "No such game")
  return game
})

route("get", API.catalog.library, ({ query }) => {
  const owned = ownedGameIds()
  const items = db.ownerships
    .filter((o) => o.status === "ACTIVE" && owned.has(o.game_id))
    .map((ownership) => ({
      ownership,
      game: db.games.find((g) => g.id === ownership.game_id) ?? null,
    }))
    .filter((entry) => entry.game !== null)
  return paginate(items, query)
})

// --- orders ----------------------------------------------------------------

route("get", API.orders.list, ({ query }) => paginate(db.orders, query))

route("get", API.orders.detail(":id"), ({ params }) => {
  const order = db.orders.find((o) => o.id === params[0])
  if (!order) throw new MockRuleError(404, "NOT_FOUND", "No such order")
  return order
})

route("post", API.orders.place, ({ body }) => buy(String(body.game_id ?? "")))

route("post", API.orders.gift, ({ body }) =>
  gift(
    String(body.game_id ?? ""),
    String(body.recipient_id ?? ""),
    String(body.message ?? "")
  )
)

route("post", API.orders.preorder, ({ body }) =>
  preorder(String(body.game_id ?? ""))
)

route("post", API.orders.instalment, ({ body }) => {
  const { order } = startInstalmentPlan(
    String(body.game_id ?? ""),
    Number(body.instalments ?? 3),
    Number(body.interval_days ?? 30)
  )
  return order
})

route("post", API.orders.refund(":id"), ({ params }) => refund(params[0]))

route("get", API.orders.plan(":id"), ({ params }) => {
  const plan = db.plans.find((p) => p.order_id === params[0])
  if (!plan)
    throw new MockRuleError(404, "NOT_FOUND", "This order has no payment plan")
  return plan
})

// --- wallet ----------------------------------------------------------------

route("get", API.wallet.me, () => db.wallet)
route("get", API.wallet.ledger, ({ query }) => paginate(db.ledger, query))
route("get", API.wallet.holds, ({ query }) => paginate([], query))
route("post", API.wallet.topUp, ({ body }) => {
  const amount = body.amount as
    { amount_minor?: string; currency?: string } | undefined
  return topUp({
    amount_minor: String(amount?.amount_minor ?? "0"),
    currency: String(amount?.currency ?? "IRR"),
  })
})

// --- notifications ---------------------------------------------------------

route("get", API.notifications.list, ({ query }) => {
  const unreadOnly = query.get("unread_only") === "true"
  const items = unreadOnly
    ? db.notifications.filter((n) => !n.read)
    : db.notifications
  return paginate(items, query)
})

route("get", API.notifications.unreadCount, () => ({
  unread: db.notifications.filter((n) => !n.read).length,
}))

route("post", API.notifications.readAll, () => {
  const unread = db.notifications.filter((n) => !n.read)
  for (const note of unread) {
    note.read = true
    note.read_at = new Date().toISOString()
  }
  return { marked: unread.length }
})

route("post", API.notifications.read(":id"), ({ params }) => {
  const note = db.notifications.find((n) => n.id === params[0])
  if (!note) throw new MockRuleError(404, "NOT_FOUND", "Not found")
  if (!note.read) {
    note.read = true
    note.read_at = new Date().toISOString()
  }
  return note
})

// --- the adapter itself ----------------------------------------------------

/** Enough latency that loading states are visible while building, not enough to
 *  be annoying. */
const LATENCY_MS = 220

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

  for (const candidate of routes) {
    if (candidate.method !== method) continue
    const match = candidate.pattern.exec(path)
    if (!match) continue

    try {
      const data = candidate.handler({ body, query, params: match.slice(1) })
      return respond(method === "post" ? 201 : 200, data)
    } catch (error) {
      if (error instanceof MockRuleError) {
        // Rejected the way axios rejects, so the response interceptor and
        // `toApiError` treat it exactly like a real failure.
        return Promise.reject(
          Object.assign(new Error(error.message), {
            isAxiosError: true,
            name: "AxiosError",
            config,
            response: respond(
              error.status,
              problem(error.status, error.reason, error.message)
            ),
          })
        )
      }
      throw error
    }
  }

  return Promise.reject(
    Object.assign(
      new Error(`no mock route for ${method.toUpperCase()} ${path}`),
      {
        isAxiosError: true,
        name: "AxiosError",
        config,
        response: respond(
          404,
          problem(
            404,
            "NOT_FOUND",
            `No mock route for ${method.toUpperCase()} ${path}`
          )
        ),
      }
    )
  )
}

export function installMockAdapter(instance: AxiosInstance): void {
  instance.defaults.adapter = adapter
}
