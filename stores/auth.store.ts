"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { clearSession, onSessionChange, saveSession } from "@/lib/session"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { subjectOf } from "@/lib/token"
import type { TokenPair, UserSummary } from "@/types/auth.api.type"
import type { Role } from "@/types/common.api.type"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  /** The token's subject, kept separately because the auth service has no `/me`
   *  route — a profile is fetched by id. */
  userId: string | null
  user: UserSummary | null
}

const EMPTY: AuthState = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  user: null,
}

interface AuthStore extends AuthState {
  signIn: (tokens: TokenPair) => void
  setUser: (user: UserSummary) => void
  signOut: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...EMPTY,
      signIn: (tokens) => {
        saveSession(tokens)
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          userId: subjectOf(tokens.access_token),
        })
      },
      setUser: (user) => set({ user }),
      signOut: () => {
        clearSession()
        set(EMPTY)
      },
    }),
    {
      name: STORAGE_KEYS.auth,
      // A no-op store during server rendering: `localStorage` does not exist
      // there, and the factory is called eagerly enough that reaching for it
      // throws rather than degrading.
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage
      ),
    }
  )
)

if (typeof window !== "undefined") {
  onSessionChange((tokens) => {
    if (!tokens) {
      useAuthStore.setState(EMPTY)
      return
    }
    useAuthStore.setState({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: subjectOf(tokens.access_token),
    })
  })
}

/**
 * Whether the caller holds one of these roles.
 *
 * Read for *navigation*, never for security: the token is checked by all seven
 * services, and hiding a link is a courtesy rather than a control. A developer
 * link a basic user reaches anyway still gets a 403 from the catalog.
 */
export function useHasRole(...roles: Role[]): boolean {
  const role = useAuthStore((state) => state.user?.role)
  return role !== undefined && roles.includes(role)
}
