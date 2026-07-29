"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import { STORAGE_KEYS } from "@/lib/storage-keys"
import type { Role } from "@/types/common.api.type"
import type { TokenPair, UserSummary } from "@/types/auth.api.type"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserSummary | null
}

const EMPTY: AuthState = { accessToken: null, refreshToken: null, user: null }

interface AuthStore extends AuthState {
  signIn: (tokens: TokenPair) => void
  setUser: (user: UserSummary) => void
  signOut: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...EMPTY,
      signIn: (tokens) =>
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        }),
      setUser: (user) => set({ user }),
      signOut: () => set(EMPTY),
    }),
    {
      name: STORAGE_KEYS.auth,
      storage: createJSONStorage(() => localStorage),
    }
  )
)

/**
 * Whether the caller holds a role.
 *
 * Read for *navigation*, never for security: the token is checked by all seven
 * services, and hiding a link is a courtesy rather than a control. A developer
 * link that a basic user can reach still gets a 403 from the catalog.
 */
export function useHasRole(...roles: Role[]): boolean {
  const role = useAuthStore((state) => state.user?.role)
  return role !== undefined && roles.includes(role)
}
