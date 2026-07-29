import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios"
import { toast } from "sonner"

import { ls } from "@/lib/local-storage"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import type { ProblemDocument } from "@/types/common.api.type"

import { installMockAdapter } from "./mocks/adapter"

export const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock"
export const IS_MOCKED = API_MODE !== "live"

export const http: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
})

/** The access token, attached to every request that has one. */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = ls.get<string | null>(STORAGE_KEYS.accessToken, null)
  if (token) config.headers.Authorization = `Bearer ${token}`
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
 * One toast per failure, raised here rather than in each mutation.
 *
 * 401 is deliberately silent: the auth store reacts to it by clearing the
 * session and the router sends the person to the sign-in page, and a toast on
 * top of a redirect is noise. 404 is silent too — a missing thing is usually
 * something the page should render as empty, not shout about.
 */
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const api = toApiError(error)
    const quiet = api.status === 401 || api.status === 404
    if (!quiet) toast.error(api.message)
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
