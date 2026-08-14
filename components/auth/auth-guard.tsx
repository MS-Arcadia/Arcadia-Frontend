"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { usePresence } from "@/hooks/use-presence"
import { useMeQuery } from "@/queries/auth"
import { useAuthStore } from "@/stores/auth.store"

/**
 * Keeps the signed-in shell signed in.
 *
 * A client-side guard, deliberately: this is **not** a security boundary. All seven
 * services verify the token themselves, so the worst a bypass achieves is a screen
 * full of 401s. What this buys is not showing that screen — somebody signed out
 * should land on the sign-in form, not on an empty store with four failed requests
 * behind it.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const userId = useAuthStore((state) => state.userId)
  const user = useAuthStore((state) => state.user)
  const hydrated = useStoreHydrated()
  const { isLoading, isError } = useMeQuery()
  // Held open for as long as somebody is signed in, which is exactly the span this
  // component already owns.
  usePresence()

  // Nothing is decided until the persisted store has been read back. Without this
  // the first render sees `userId: null` — persist rehydrates a tick later — and
  // every navigation bounced a signed-in person to the sign-in form.
  useEffect(() => {
    if (hydrated && !userId) router.replace("/sign-in")
  }, [hydrated, userId, router])

  // A stored token the server no longer accepts — expired, revoked, or from a
  // database that has since been reset. Clearing it stops an endless loop of
  // failed profile fetches.
  useEffect(() => {
    if (isError) {
      useAuthStore.getState().signOut()
      router.replace("/sign-in")
    }
  }, [isError, router])

  if (!hydrated || !userId || (isLoading && !user)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          aria-label="Loading"
        />
      </div>
    )
  }

  return <>{children}</>
}

function subscribeToHydration(onChange: () => void): () => void {
  return useAuthStore.persist?.onFinishHydration(onChange) ?? (() => undefined)
}

/** True once persist has read localStorage. No persistence at all also counts —
 *  there is nothing to wait for. */
function hydrationSnapshot(): boolean {
  return useAuthStore.persist?.hasHydrated() ?? true
}

/** On the server there is no localStorage and nothing to rehydrate, and returning
 *  `false` is what makes the first client render agree with the server's. */
function serverSnapshot(): boolean {
  return false
}

/**
 * Whether zustand's `persist` has finished reading localStorage.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: hydration status is
 * an external store, which is precisely what this hook is for. The state version
 * called `setState` inside an effect, which cascades a render and is what
 * `react-hooks/set-state-in-effect` exists to catch. It also gives an explicit
 * server snapshot instead of touching `persist` during SSR, where the middleware
 * has not attached itself and reading it threw.
 */
function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    hydrationSnapshot,
    serverSnapshot
  )
}
