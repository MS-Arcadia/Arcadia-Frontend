import { ls } from "@/lib/local-storage"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import type { TokenPair } from "@/types/auth.api.type"

/**
 * The two tokens the HTTP client and the auth store must agree on.
 *
 * They live under their own keys so `services/http.ts` can read them without
 * importing the Zustand store — that store is a client module, and pulling it
 * into the API layer would mark every caller a client component. When the
 * interceptor refreshes a pair it writes here and notifies; the store
 * subscribes and stays in step.
 */

type Listener = (tokens: TokenPair | null) => void

const listeners = new Set<Listener>()

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(tokens: TokenPair | null): void {
  for (const listener of listeners) listener(tokens)
}

export function readAccessToken(): string | null {
  return ls.get<string | null>(STORAGE_KEYS.accessToken, null)
}

export function readRefreshToken(): string | null {
  return ls.get<string | null>(STORAGE_KEYS.refreshToken, null)
}

export function saveSession(tokens: TokenPair): void {
  ls.set(STORAGE_KEYS.accessToken, tokens.access_token)
  ls.set(STORAGE_KEYS.refreshToken, tokens.refresh_token)
  emit(tokens)
}

export function clearSession(): void {
  ls.remove(STORAGE_KEYS.accessToken)
  ls.remove(STORAGE_KEYS.refreshToken)
  emit(null)
}
