"use client"

import { useSyncExternalStore } from "react"

import { useAuthStore } from "@/stores/auth.store"

/**
 * Extra inset for unsigned visitors on the marketing chrome. Signed-in
 * community reuses the app main's padding, so stacking another `px-6` would
 * push the feed off-centre.
 */
export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userId = useAuthStore((state) => state.userId)
  const hydrated = useStoreHydrated()

  if (hydrated && userId) {
    return children
  }

  return <div className="px-6 py-10 lg:px-10">{children}</div>
}

function subscribeToHydration(onChange: () => void): () => void {
  return useAuthStore.persist?.onFinishHydration(onChange) ?? (() => undefined)
}

function hydrationSnapshot(): boolean {
  return useAuthStore.persist?.hasHydrated() ?? true
}

function serverSnapshot(): boolean {
  return false
}

function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    hydrationSnapshot,
    serverSnapshot
  )
}
