"use client"

import { useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { TopBar } from "@/components/layout/top-bar"
import { MarketingHeader } from "@/components/marketing/marketing-header"
import { PrefetchPublicRoutes } from "@/components/pwa/prefetch-public"
import { useAuthStore } from "@/stores/auth.store"

/**
 * Public chrome by default; the signed-in app rail on community and festivals.
 *
 * Those routes live under `(marketing)` so unsigned visitors can read them, but
 * once there is a session they are part of the product again — hiding the
 * sidebar made them the only signed-in destinations without the rest of the
 * nav.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const userId = useAuthStore((state) => state.userId)
  const hydrated = useStoreHydrated()
  const useAppChrome =
    pathname === "/community" ||
    pathname.startsWith("/community/") ||
    pathname === "/festivals" ||
    pathname.startsWith("/festivals/")

  if (hydrated && userId && useAppChrome) {
    return (
      <div className="flex min-h-dvh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 px-4 pt-6 pb-24 lg:px-8 lg:pb-12">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PrefetchPublicRoutes />
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/70">
            Arcadia — a game distribution platform. Seven services, one
            storefront.
          </p>
          <p className="text-xs text-muted-foreground/50">
            Wallet · Payments · Catalogue · Orders · Media · Auth ·
            Notifications
          </p>
        </div>
      </footer>
    </div>
  )
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
