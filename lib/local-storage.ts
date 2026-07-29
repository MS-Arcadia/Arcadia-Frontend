import type { StorageKey } from "./storage-keys"

/**
 * The only place this app touches `localStorage`.
 *
 * Wrapped for two reasons that both bite in practice: `localStorage` does not
 * exist during server rendering, and it throws rather than returning null when a
 * browser is in a mode that forbids it (Safari private browsing, or a storage
 * quota that is full). A component that read it directly would either break the
 * build or crash for a minority of real users.
 */
export const ls = {
  get<T>(key: StorageKey, fallback: T): T {
    if (typeof window === "undefined") return fallback
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },

  set(key: StorageKey, value: unknown): void {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // A full quota is not worth breaking a render over.
    }
  },

  remove(key: StorageKey): void {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing useful to do.
    }
  },
}
