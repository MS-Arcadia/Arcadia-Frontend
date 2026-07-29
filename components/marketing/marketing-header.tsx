"use client"

import Link from "next/link"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth.store"

/**
 * The public header.
 *
 * The call to action depends on whether there is already a session: somebody who is
 * signed in and lands here from a bookmark wants the store, not an invitation to
 * create the account they already have.
 */
export function MarketingHeader() {
  const userId = useAuthStore((state) => state.userId)

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6 lg:px-10">
        <Link href="/" aria-label="Arcadia">
          <Logo priority className="w-32" />
        </Link>

        <nav className="ms-auto flex items-center gap-2">
          {userId ? (
            <Button
              className="min-h-11"
              nativeButton={false}
              render={<Link href="/store" />}
            >
              Open the store
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="min-h-11"
                nativeButton={false}
                render={<Link href="/sign-in" />}
              >
                Sign in
              </Button>
              <Button
                className="min-h-11"
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                Create an account
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
