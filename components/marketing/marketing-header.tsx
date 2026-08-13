"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth.store"

/**
 * The public header.
 *
 * The call to action depends on whether there is already a session: somebody who is
 * signed in and lands here from a bookmark wants the store, not an invitation to
 * create the account they already have.
 */
/**
 * Only what a signed-out visitor can actually open.
 *
 * Festivals are a public read too, but the festivals screen is one page with
 * admin controls on it — a second, signed-out copy would be two implementations
 * of the same list. It belongs here once that page can serve both.
 */
const PUBLIC_LINKS = [{ href: "/browse", label: "Games" }] as const

export function MarketingHeader() {
  const userId = useAuthStore((state) => state.userId)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6 lg:px-10">
        <Link href="/" aria-label="Arcadia">
          <Logo priority className="w-32" />
        </Link>

        {/* The public sections, in the navbar rather than reachable only by
            guessing a URL. Catalog's list and detail reads are public by design
            — a store page is meant to be linked and indexed — and until now the
            only thing a visitor could do here was create an account. */}
        <nav className="hidden items-center gap-1 md:flex">
          {PUBLIC_LINKS.map((link) => {
            const current =
              pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  current
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

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
