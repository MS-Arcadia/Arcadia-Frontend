import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios"
import { toast } from "sonner"

import { API } from "@/lib/api-paths"
import {
  clearSession,
  readAccessToken,
  readRefreshToken,
  saveSession,
} from "@/lib/session"
import { needsRefresh } from "@/lib/token"
import type { TokenPair } from "@/types/auth.api.type"
import type { ProblemDocument } from "@/types/common.api.type"

import { installMockAdapter } from "./mocks/adapter"

export const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock"
export const IS_MOCKED = API_MODE !== "live"

export const http: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
})

/**
 * Login, register, refresh and logout take a refresh token in the body (or no
 * token at all). The gateway verifies a bearer token *if one is present*, so an
 * expired access token on these calls never reaches the auth service — it dies
 * at the edge as TOKEN_EXPIRED. That is why attaching the usual header here
 * would make refresh itself impossible.
 */
function isCredentialExchange(config: InternalAxiosRequestConfig): boolean {
  const url = `${config.baseURL ?? ""}${config.url ?? ""}`
  return /\/auth\/v1\/auth\/(login|register|refresh|logout)(?:\?|$)/.test(url)
}

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean }

let refreshing: Promise<string | null> | null = null

/**
 * One in-flight refresh, shared by every caller that noticed the access token
 * was dead. Without this, a page of parallel queries would each mint a new
 * access token and race to write it.
 */
function refreshSession(): Promise<string | null> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    const refreshToken = readRefreshToken()
    if (!refreshToken) return null
    try {
      const { data } = await http.post<TokenPair>(API.auth.refresh, {
        refresh_token: refreshToken,
      })
      saveSession(data)
      return data.access_token
    } catch {
      clearSession()
      return null
    }
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

/**
 * The access token, attached to every request that has one — except the
 * credential-exchange routes, and refreshed first if it is about to expire.
 */
http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (isCredentialExchange(config)) {
    config.headers.delete("Authorization")
    return config
  }

  let token = readAccessToken()
  if (token && needsRefresh(token)) {
    token = (await refreshSession()) ?? token
  }
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const WRITES = new Set(["post", "put", "patch", "delete"])

/**
 * An `Idempotency-Key` on every write.
 *
 * Not optional: wallet-service refuses any operation that moves money without one, and
 * order-service calls it "mandatory, never defaulted" for placing an order, gifting and
 * pre-ordering. Nothing here sent one, so against the real platform buying a game, topping
 * up, redeeming a gift card and every other write answered 400 — while the mock, which
 * never asked for the header, made all of it look fine.
 *
 * Minting it client-side is the point rather than a workaround. The services deliberately
 * will not invent a key, because only the caller knows whether a second request is a new
 * purchase or the same one arriving twice. The key is written onto the request config, so
 * an axios retry of *this* request carries the same one and the service can recognise the
 * duplicate — which is exactly the protection the header exists for.
 */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = config.method?.toLowerCase() ?? "get"
  if (WRITES.has(method) && !config.headers["Idempotency-Key"]) {
    config.headers["Idempotency-Key"] = crypto.randomUUID()
  }
  return config
})

/**
 * Turn a service's RFC 7807 document into a message worth showing, once.
 *
 * Every Arcadia service answers failures the same way — a problem document with
 * a machine-readable `reason` — so translating them belongs here rather than in
 * forty `onError` handlers. `reason` is what gets mapped: `detail` is written for
 * an operator reading a log, not for the person who just clicked the button.
 */
const MESSAGES: Record<string, string> = {
  TOKEN_MISSING: "Sign in to do that.",
  TOKEN_INVALID: "Your session is not valid. Sign in again.",
  TOKEN_EXPIRED: "Your session has expired. Sign in again.",
  REFRESH_TOKEN_USED:
    "That token cannot be used to call the API. Sign in again.",
  WRONG_TOKEN_TYPE: "Your session is not valid. Sign in again.",
  ROLE_REQUIRED: "Your role does not have access to this.",
  FOREIGN_SUBJECT: "That belongs to another account.",
  VALIDATION_FAILED: "Some of what was sent is missing or invalid.",
  INSUFFICIENT_FUNDS: "Your wallet balance is not enough.",
  ALREADY_OWNED: "This game is already in your library.",
  NOT_FOR_SALE: "This game is not on sale right now.",
  REFUND_WINDOW_CLOSED: "The 12-hour refund window has closed.",
  GIFT_NOT_REFUNDABLE: "A gift cannot be refunded.",
  ALREADY_REFUNDED: "This order has already been refunded.",
  REFUND_IN_PROGRESS: "A refund for this order is already in progress.",
  ORDER_NOT_COMPLETED: "This order cannot be refunded.",
  DISCOUNT_CODE_INVALID: "That discount code is not valid.",
  DISCOUNT_CODE_SPENT: "That discount code has already been used.",
  PAYMENT_GATEWAY_UNAUTHORIZED:
    "The payment gateway is unavailable. Try again shortly.",
}

export interface ApiError {
  status: number
  reason: string
  message: string
  field?: string
}

/**
 * Normalise anything axios can throw into one shape the UI can branch on.
 *
 * `axios.isAxiosError` rather than `instanceof AxiosError`: the mock adapter
 * rejects with an object carrying the `isAxiosError` flag, which is the contract
 * axios itself documents, and a prototype check would classify every mocked
 * failure as UNKNOWN and lose its reason code.
 */
export function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return { status: 0, reason: "UNKNOWN", message: "Something went wrong." }
  }

  if (!error.response) {
    return {
      status: 0,
      reason: error.code === "ECONNABORTED" ? "TIMEOUT" : "NETWORK",
      message:
        error.code === "ECONNABORTED"
          ? "The server did not answer. Check your connection."
          : "Could not reach the server. Check your connection.",
    }
  }

  const problem = error.response.data as Partial<ProblemDocument> | undefined
  const reason = problem?.reason ?? "UNKNOWN"
  return {
    status: error.response.status,
    reason,
    message:
      MESSAGES[reason] ?? problem?.detail ?? "The request did not go through.",
    field: problem?.field,
  }
}

/**
 * One toast per failed **action**, raised here rather than in each mutation.
 *
 * Writes only. A GET that fails is a read, and every screen that reads already has
 * somewhere to say so — an empty state, an inline message, a retry. Toasting those too
 * meant a background refetch could interrupt whatever somebody was actually doing with a
 * message about something else entirely: adding a game to a festival and being told your
 * wallet balance is too low, from a poll that happened to land at that moment. An error
 * that belongs to no visible action is worse than no error, because it sends people
 * looking for a problem in the thing they were doing.
 *
 * 401 is silent for both: the interceptor below refreshes, or the auth store
 * clears the session and the router moves to sign-in. A toast on top of either
 * is noise. 404 is silent because a missing thing is usually something a page
 * should render as empty.
 */
const SILENT_STATUSES = new Set([401, 404])

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const config = error.config as RetryConfig | undefined
      if (config && !config._retried && !isCredentialExchange(config)) {
        config._retried = true
        const token = await refreshSession()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
          return http.request(config)
        }
      }
    }

    const api = toApiError(error)
    const method = (
      axios.isAxiosError(error) ? (error.config?.method ?? "get") : "get"
    ).toLowerCase()

    if (WRITES.has(method) && !SILENT_STATUSES.has(api.status)) {
      toast.error(api.message)
    }
    return Promise.reject(error)
  }
)

// Installed synchronously, at module scope, on purpose. A dynamic import here
// would resolve a tick later than the first query fires, so the opening request
// of a cold page load would go to the network and fail while every later one
// succeeded — a race that looks like a flaky backend.
//
// `NEXT_PUBLIC_*` is inlined at build time, so with API_MODE=live this branch
// folds to `if (false)` and the fixtures drop out of the bundle.
if (IS_MOCKED) {
  installMockAdapter(http)
}
